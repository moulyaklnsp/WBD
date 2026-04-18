function normalizeSolrBaseUrl(raw) {
  const fallback = 'http://localhost:8983/solr';
  let baseUrl = String(raw || fallback).trim();
  if (!baseUrl) baseUrl = fallback;
  baseUrl = baseUrl.replace(/\/+$/, '');
  if (!baseUrl.endsWith('/solr')) baseUrl = `${baseUrl}/solr`;
  return baseUrl;
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function safeString(value) {
  if (value == null) return '';
  return String(value);
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function toNonNegativeInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function buildDocId(entity, data) {
  const explicit = safeString(data?.id).trim();
  if (explicit) return explicit;
  const oid = safeString(data?._id).trim();
  if (oid) return `${entity}:${oid}`;
  return `${entity}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

async function fetchText(fetchImpl, url, options) {
  const res = await fetchImpl(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options && options.headers ? options.headers : {})
    }
  });
  const text = await res.text();
  return { res, text };
}

async function fetchJson(fetchImpl, url, options) {
  const { res, text } = await fetchText(fetchImpl, url, options);
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

function isOkUpdateResponse(json) {
  // Typical update response: { responseHeader: { status: 0, ... } }
  const status = json?.responseHeader?.status;
  return status === 0 || status === '0' || status == null;
}

class SolrService {
  constructor({
    baseUrl = process.env.SOLR_BASE_URL,
    coreName = process.env.SOLR_CORE_NAME,
    fetchImpl = global.fetch,
    logger = console,
    commitWithinMs = 1000
  } = {}) {
    this.baseUrl = normalizeSolrBaseUrl(baseUrl);
    this.coreName = String(coreName || 'chesshive').trim() || 'chesshive';
    this.fetchImpl = fetchImpl;
    this.logger = logger || console;
    this.commitWithinMs = toPositiveInt(commitWithinMs, 1000);
  }

  coreBaseUrl() {
    return `${this.baseUrl}/${encodeURIComponent(this.coreName)}`;
  }

  buildVisibleToFilter(role) {
    const r = safeString(role).trim();
    if (!r) return 'visible_to:(public)';
    return `visible_to:(${r} OR public)`;
  }

  buildEntityFilter(entity) {
    const e = safeString(entity).trim();
    return e ? `entity:${e}` : null;
  }

  /**
   * Upsert a single Solr document for an entity.
   * NOTE: `data` should already be mapped into Solr schema fields (Step 4).
   */
  async indexDocument(entity, data) {
    try {
      const ent = safeString(entity).trim();
      if (!ent) return { success: false, error: 'Missing entity' };
      if (!data || typeof data !== 'object') return { success: false, error: 'Missing document data' };
      if (!this.fetchImpl) return { success: false, error: 'Missing fetch implementation' };

      const doc = {
        ...data,
        id: buildDocId(ent, data),
        entity: ent,
        visible_to: toArray(data.visible_to).length ? toArray(data.visible_to) : ['public']
      };

      const url = `${this.coreBaseUrl()}/update?wt=json&commitWithin=${encodeURIComponent(String(this.commitWithinMs))}`;
      const { res, json, text } = await fetchJson(this.fetchImpl, url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([doc])
      });

      if (!res.ok) {
        this.logger.error('[solr] indexDocument failed:', res.status, res.statusText, text);
        return { success: false, status: res.status, error: 'Solr update failed' };
      }
      if (!json) {
        this.logger.error('[solr] indexDocument invalid JSON response:', text);
        return { success: false, error: 'Solr update returned invalid JSON' };
      }
      if (!isOkUpdateResponse(json)) {
        this.logger.error('[solr] indexDocument bad response:', json);
        return { success: false, error: 'Solr update returned non-zero status', raw: json };
      }

      return { success: true, id: doc.id };
    } catch (err) {
      this.logger.error('[solr] indexDocument error:', err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Bulk upsert documents for an entity.
   * NOTE: `dataArray` documents should already be mapped into Solr schema fields (Step 4).
   */
  async indexBatch(entity, dataArray) {
    try {
      const ent = safeString(entity).trim();
      if (!ent) return { success: false, error: 'Missing entity' };
      if (!Array.isArray(dataArray)) return { success: false, error: 'dataArray must be an array' };
      if (!this.fetchImpl) return { success: false, error: 'Missing fetch implementation' };

      const docs = (dataArray || [])
        .filter((d) => d && typeof d === 'object')
        .map((d) => ({
          ...d,
          id: buildDocId(ent, d),
          entity: ent,
          visible_to: toArray(d.visible_to).length ? toArray(d.visible_to) : ['public']
        }));

      const url = `${this.coreBaseUrl()}/update?wt=json&commitWithin=${encodeURIComponent(String(this.commitWithinMs))}`;
      const { res, json, text } = await fetchJson(this.fetchImpl, url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(docs)
      });

      if (!res.ok) {
        this.logger.error('[solr] indexBatch failed:', res.status, res.statusText, text);
        return { success: false, status: res.status, error: 'Solr update failed' };
      }
      if (!json) {
        this.logger.error('[solr] indexBatch invalid JSON response:', text);
        return { success: false, error: 'Solr update returned invalid JSON' };
      }
      if (!isOkUpdateResponse(json)) {
        this.logger.error('[solr] indexBatch bad response:', json);
        return { success: false, error: 'Solr update returned non-zero status', raw: json };
      }

      return { success: true, count: docs.length };
    } catch (err) {
      this.logger.error('[solr] indexBatch error:', err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  async deleteDocument(entity, id) {
    try {
      const ent = safeString(entity).trim();
      const rawId = safeString(id).trim();
      if (!ent) return { success: false, error: 'Missing entity' };
      if (!rawId) return { success: false, error: 'Missing id' };
      if (!this.fetchImpl) return { success: false, error: 'Missing fetch implementation' };

      const deleteId = rawId.includes(':') ? rawId : `${ent}:${rawId}`;
      const url = `${this.coreBaseUrl()}/update?wt=json&commitWithin=${encodeURIComponent(String(this.commitWithinMs))}`;
      const { res, json, text } = await fetchJson(this.fetchImpl, url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ delete: deleteId })
      });

      if (!res.ok) {
        this.logger.error('[solr] deleteDocument failed:', res.status, res.statusText, text);
        return { success: false, status: res.status, error: 'Solr delete failed' };
      }
      if (!json) {
        this.logger.error('[solr] deleteDocument invalid JSON response:', text);
        return { success: false, error: 'Solr delete returned invalid JSON' };
      }
      if (!isOkUpdateResponse(json)) {
        this.logger.error('[solr] deleteDocument bad response:', json);
        return { success: false, error: 'Solr delete returned non-zero status', raw: json };
      }

      return { success: true, id: deleteId };
    } catch (err) {
      this.logger.error('[solr] deleteDocument error:', err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  normalizeFacetCounts(solrJson) {
    const facetFields = solrJson?.facet_counts?.facet_fields || {};
    const normalized = {};
    Object.keys(facetFields).forEach((field) => {
      const arr = facetFields[field];
      if (!Array.isArray(arr)) return;
      const map = {};
      for (let i = 0; i < arr.length; i += 2) {
        const k = safeString(arr[i]);
        const v = Number(arr[i + 1] || 0);
        if (k) map[k] = v;
      }
      normalized[field] = map;
    });
    return normalized;
  }

  /**
   * Execute a search against a single entity partition.
   * Normalizes results to: { success, docs, total, facetCounts }.
   */
  async search(entity, queryParams = {}) {
    try {
      const ent = safeString(entity).trim();
      if (!ent) return { success: false, docs: [], total: 0, facetCounts: {}, error: 'Missing entity' };
      if (!this.fetchImpl) return { success: false, docs: [], total: 0, facetCounts: {}, error: 'Missing fetch implementation' };

      const qRaw = safeString(queryParams.q).trim();
      const pageSize = Math.min(toPositiveInt(queryParams.pageSize, 20), 200);
      const page = toPositiveInt(queryParams.page, 1);

      const startOverrideRaw = queryParams.start ?? queryParams.skip ?? queryParams.startIndex;
      const startOverride = startOverrideRaw != null ? toNonNegativeInt(startOverrideRaw, null) : null;
      const start = startOverride != null ? startOverride : (page - 1) * pageSize;

      const params = new URLSearchParams();
      params.set('wt', 'json');
      params.set('start', String(start));
      params.set('rows', String(pageSize));

      // Full-text search via edismax on `_text_` catch-all
      if (qRaw) {
        params.set('defType', 'edismax');
        params.set('qf', '_text_');
        params.set('q', qRaw);
      } else {
        params.set('q', '*:*');
      }

      const fq = [];
      const entityFq = this.buildEntityFilter(ent);
      if (entityFq) fq.push(entityFq);
      fq.push(this.buildVisibleToFilter(queryParams.role));

      // Optional extra filter queries (internal-only; controllers must not expose role filters)
      const extraFq = toArray(queryParams.fq).map((v) => safeString(v).trim()).filter(Boolean);
      extraFq.forEach((v) => fq.push(v));

      fq.forEach((v) => params.append('fq', v));

      if (queryParams.sort) params.set('sort', safeString(queryParams.sort));

      const facets = toArray(queryParams.facets).map((v) => safeString(v).trim()).filter(Boolean);
      if (facets.length) {
        params.set('facet', 'true');
        facets.forEach((f) => params.append('facet.field', f));
        params.set('facet.mincount', '1');
        params.set('facet.limit', '50');
      }

      const url = `${this.coreBaseUrl()}/select?${params.toString()}`;
      const { res, json, text } = await fetchJson(this.fetchImpl, url);

      if (!res.ok) {
        this.logger.error('[solr] search failed:', res.status, res.statusText, text);
        return { success: false, docs: [], total: 0, facetCounts: {}, status: res.status, error: 'Solr search failed' };
      }
      if (!json) {
        this.logger.error('[solr] search invalid JSON response:', text);
        return { success: false, docs: [], total: 0, facetCounts: {}, error: 'Solr search returned invalid JSON' };
      }

      const docs = json?.response?.docs || [];
      const total = Number(json?.response?.numFound || 0);
      const facetCounts = this.normalizeFacetCounts(json);
      return { success: true, docs, total, facetCounts, raw: json };
    } catch (err) {
      this.logger.error('[solr] search error:', err?.message || err);
      return { success: false, docs: [], total: 0, facetCounts: {}, error: err?.message || String(err) };
    }
  }
}

function createSolrService(overrides = {}) {
  return new SolrService(overrides);
}

module.exports = { SolrService, createSolrService };
