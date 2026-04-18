function loadSolrService({ fetchImpl, env = {}, overrides = {} } = {}) {
  jest.resetModules();

  const previousEnv = { ...process.env };
  process.env = { ...previousEnv, ...env };

  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn()
  };

  // eslint-disable-next-line global-require
  const { SolrService } = require('../../solr/SolrService');
  const service = new SolrService({
    baseUrl: 'http://solr.local:8983/solr',
    coreName: 'chesshive',
    fetchImpl,
    logger,
    ...overrides
  });

  return {
    service,
    logger,
    restoreEnv: () => {
      process.env = previousEnv;
    }
  };
}

function makeFetchOk(json) {
  return jest.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(json || { responseHeader: { status: 0 } })
  }));
}

function makeFetchHttpError(status = 500, body = 'err') {
  return jest.fn(async () => ({
    ok: false,
    status,
    statusText: 'ERR',
    text: async () => body
  }));
}

describe('SolrService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('indexDocument upserts one doc and returns id', async () => {
    const fetchImpl = makeFetchOk({ responseHeader: { status: 0 } });
    const { service, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.indexDocument('users', { _id: 'u1', user_email_s: 'a@b.com', visible_to: ['player'] });
    restoreEnv();

    expect(result).toMatchObject({ success: true, id: 'users:u1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/chesshive/update?');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual([
      expect.objectContaining({ id: 'users:u1', entity: 'users', visible_to: ['player'] })
    ]);
  });

  test('indexDocument logs and returns success=false on non-200', async () => {
    const fetchImpl = makeFetchHttpError(503, 'down');
    const { service, logger, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.indexDocument('users', { _id: 'u1' });
    restoreEnv();

    expect(result).toMatchObject({ success: false, status: 503 });
    expect(logger.error).toHaveBeenCalled();
  });

  test('indexBatch upserts array and returns count', async () => {
    const fetchImpl = makeFetchOk({ responseHeader: { status: 0 } });
    const { service, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.indexBatch('products', [{ _id: 'p1' }, { _id: 'p2', visible_to: 'admin' }]);
    restoreEnv();

    expect(result).toMatchObject({ success: true, count: 2 });
    const [, opts] = fetchImpl.mock.calls[0];
    const docs = JSON.parse(opts.body);
    expect(docs[0]).toMatchObject({ id: 'products:p1', entity: 'products', visible_to: ['public'] });
    expect(docs[1]).toMatchObject({ id: 'products:p2', entity: 'products', visible_to: ['admin'] });
  });

  test('deleteDocument prefixes id with entity when needed', async () => {
    const fetchImpl = makeFetchOk({ responseHeader: { status: 0 } });
    const { service, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.deleteDocument('blogs', 'b1');
    restoreEnv();

    expect(result).toMatchObject({ success: true, id: 'blogs:b1' });
    const [, opts] = fetchImpl.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ delete: 'blogs:b1' });
  });

  test('search builds entity + role filter and normalizes facets', async () => {
    const solrResponse = {
      response: { numFound: 2, docs: [{ id: 'users:u1' }, { id: 'users:u2' }] },
      facet_counts: {
        facet_fields: {
          user_role_s: ['player', 2, 'admin', 0]
        }
      }
    };
    const fetchImpl = makeFetchOk(solrResponse);
    const { service, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.search('users', {
      q: 'alice',
      role: 'player',
      page: 2,
      pageSize: 10,
      facets: ['user_role_s']
    });
    restoreEnv();

    expect(result).toMatchObject({
      success: true,
      total: 2,
      docs: [{ id: 'users:u1' }, { id: 'users:u2' }],
      facetCounts: { user_role_s: { player: 2 } }
    });

    const [url] = fetchImpl.mock.calls[0];
    const u = new URL(String(url));
    expect(u.pathname).toBe('/solr/chesshive/select');
    expect(u.searchParams.get('q')).toBe('alice');
    expect(u.searchParams.get('defType')).toBe('edismax');
    expect(u.searchParams.get('qf')).toBe('_text_');
    expect(u.searchParams.get('start')).toBe('10');
    expect(u.searchParams.get('rows')).toBe('10');

    const fqs = u.searchParams.getAll('fq');
    expect(fqs).toContain('entity:users');
    expect(fqs).toContain('visible_to:(player OR public)');
    expect(u.searchParams.get('facet')).toBe('true');
    expect(u.searchParams.getAll('facet.field')).toEqual(['user_role_s']);
  });

  test('search returns success=false on HTTP error', async () => {
    const fetchImpl = makeFetchHttpError(500, 'boom');
    const { service, logger, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.search('users', { q: 'x', role: 'player' });
    restoreEnv();

    expect(result).toMatchObject({ success: false, status: 500 });
    expect(result.docs).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  test('search uses explicit start when provided', async () => {
    const solrResponse = { response: { numFound: 1, docs: [{ id: 'products:p1' }] } };
    const fetchImpl = makeFetchOk(solrResponse);
    const { service, restoreEnv } = loadSolrService({ fetchImpl });

    const result = await service.search('products', { q: '', role: 'player', page: 99, pageSize: 10, start: 5 });
    restoreEnv();

    expect(result).toMatchObject({ success: true, total: 1 });
    const [url] = fetchImpl.mock.calls[0];
    const u = new URL(String(url));
    expect(u.searchParams.get('start')).toBe('5');
    expect(u.searchParams.get('rows')).toBe('10');
  });
});
