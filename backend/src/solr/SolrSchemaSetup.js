const fs = require('fs');
const path = require('path');

const dotenvPath = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(dotenvPath)) {
  // Keep behavior consistent with backend/src/app.js (load backend/.env).
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: dotenvPath });
} else {
  // eslint-disable-next-line global-require
  require('dotenv').config();
}

function normalizeSolrBaseUrl(raw) {
  const fallback = 'http://localhost:8983/solr';
  let baseUrl = String(raw || fallback).trim();
  if (!baseUrl) baseUrl = fallback;
  baseUrl = baseUrl.replace(/\/+$/, '');
  if (!baseUrl.endsWith('/solr')) baseUrl = `${baseUrl}/solr`;
  return baseUrl;
}

async function readJsonFile(filePath) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function fetchJson(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options && options.headers ? options.headers : {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = new Error(`Solr HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = text;
    err.json = json;
    throw err;
  }
  return json;
}

function hasSchemaError(solrResponse) {
  if (!solrResponse) return false;
  if (solrResponse.error) return true;
  if (solrResponse.errors && Object.keys(solrResponse.errors).length > 0) return true;
  return false;
}

async function ensureCoreExists(solrBaseUrl, coreName) {
  const statusUrl = `${solrBaseUrl}/admin/cores?action=STATUS&wt=json`;
  const status = await fetchJson(statusUrl);
  const cores = status?.status || {};
  if (cores[coreName]) return { created: false };

  const createParams = new URLSearchParams({
    action: 'CREATE',
    name: coreName,
    configSet: '_default',
    wt: 'json'
  });
  const createUrl = `${solrBaseUrl}/admin/cores?${createParams.toString()}`;
  const created = await fetchJson(createUrl);
  if (hasSchemaError(created)) {
    const err = new Error(`Failed to create Solr core '${coreName}'`);
    err.solr = created;
    throw err;
  }

  // Wait until the core shows up in STATUS
  for (let attempt = 0; attempt < 20; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 300));
    // eslint-disable-next-line no-await-in-loop
    const after = await fetchJson(statusUrl);
    if (after?.status && after.status[coreName]) return { created: true };
  }

  const err = new Error(`Timed out waiting for core '${coreName}' to become available`);
  err.coreName = coreName;
  throw err;
}

async function getCurrentSchema(solrBaseUrl, coreName) {
  const url = `${solrBaseUrl}/${encodeURIComponent(coreName)}/schema?wt=json`;
  const json = await fetchJson(url);
  return json?.schema || {};
}

async function postSchemaCommand(solrBaseUrl, coreName, commandBody) {
  const url = `${solrBaseUrl}/${encodeURIComponent(coreName)}/schema?wt=json`;
  const res = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(commandBody)
  });
  if (hasSchemaError(res)) {
    const err = new Error('Solr Schema API error');
    err.solr = res;
    err.commandBody = commandBody;
    throw err;
  }
  return res;
}

function indexByName(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    if (item && item.name) map.set(item.name, item);
  });
  return map;
}

function copyFieldKey(cf) {
  return `${String(cf?.source || '')}=>${String(cf?.dest || '')}`;
}

async function applySchemaSpec(solrBaseUrl, coreName, spec) {
  const schema = await getCurrentSchema(solrBaseUrl, coreName);

  const existingFieldTypes = indexByName(schema.fieldTypes);
  const existingFields = indexByName(schema.fields);
  const existingDynamicFields = indexByName(schema.dynamicFields);
  const existingCopyFields = new Set((schema.copyFields || []).map(copyFieldKey));

  const applied = {
    fieldTypesAdded: 0,
    fieldsAdded: 0,
    dynamicFieldsAdded: 0,
    copyFieldsAdded: 0
  };

  for (const ft of spec.fieldTypes || []) {
    if (!ft?.name) continue;
    if (existingFieldTypes.has(ft.name)) continue;
    // eslint-disable-next-line no-await-in-loop
    await postSchemaCommand(solrBaseUrl, coreName, { 'add-field-type': ft });
    applied.fieldTypesAdded += 1;
  }

  for (const field of spec.fields || []) {
    if (!field?.name) continue;
    if (existingFields.has(field.name)) continue;
    // eslint-disable-next-line no-await-in-loop
    await postSchemaCommand(solrBaseUrl, coreName, { 'add-field': field });
    applied.fieldsAdded += 1;
  }

  for (const dyn of spec.dynamicFields || []) {
    if (!dyn?.name) continue;
    if (existingDynamicFields.has(dyn.name)) continue;
    // eslint-disable-next-line no-await-in-loop
    await postSchemaCommand(solrBaseUrl, coreName, { 'add-dynamic-field': dyn });
    applied.dynamicFieldsAdded += 1;
  }

  for (const cf of spec.copyFields || []) {
    const key = copyFieldKey(cf);
    if (!cf?.source || !cf?.dest) continue;
    if (existingCopyFields.has(key)) continue;
    // eslint-disable-next-line no-await-in-loop
    await postSchemaCommand(solrBaseUrl, coreName, { 'add-copy-field': cf });
    applied.copyFieldsAdded += 1;
  }

  return applied;
}

async function setupSolrSchema({
  solrBaseUrl = process.env.SOLR_BASE_URL,
  coreName = process.env.SOLR_CORE_NAME,
  schemaSpecPath = process.env.SOLR_SCHEMA_SPEC_PATH
} = {}) {
  const baseUrl = normalizeSolrBaseUrl(solrBaseUrl);
  const core = String(coreName || 'chesshive').trim() || 'chesshive';
  const specPath = schemaSpecPath
    ? path.resolve(schemaSpecPath)
    : path.resolve(__dirname, 'schema', 'schemaSpec.json');

  try {
    const spec = await readJsonFile(specPath);
    const coreResult = await ensureCoreExists(baseUrl, core);
    const applied = await applySchemaSpec(baseUrl, core, spec);
    return { success: true, baseUrl, coreName: core, createdCore: coreResult.created, applied };
  } catch (err) {
    console.error('[solr] Schema setup failed:', err?.message || err);
    if (err?.body) console.error('[solr] Response body:', err.body);
    if (err?.solr) console.error('[solr] Solr error:', err.solr);
    return { success: false, baseUrl, coreName: core, error: err?.message || String(err) };
  }
}

module.exports = { setupSolrSchema };

if (require.main === module) {
  // eslint-disable-next-line no-unused-vars
  (async () => {
    const result = await setupSolrSchema();
    if (!result.success) process.exitCode = 1;
    else console.log('[solr] Schema setup OK:', result);
  })();
}

