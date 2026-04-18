function parseBool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

function isSolrEnabled() {
  return parseBool(process.env.SOLR_ENABLED, false);
}

module.exports = { isSolrEnabled, parseBool };

