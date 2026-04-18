function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function mapStreamToSolrDoc(stream) {
  const id = stream?._id != null ? String(stream._id) : '';
  const title = safeTrim(stream?.title);
  const url = safeTrim(stream?.url);
  const platform = safeTrim(stream?.platform).toLowerCase();
  const streamType = safeTrim(stream?.streamType).toLowerCase();
  const description = safeTrim(stream?.description);
  const matchLabel = safeTrim(stream?.matchLabel);
  const createdByEmail = safeTrim(stream?.createdByEmail).toLowerCase();
  const createdByName = safeTrim(stream?.createdByName);

  return {
    id: id ? `streams:${id}` : undefined,
    stream_title_txt: title || undefined,
    stream_url_s: url || undefined,
    stream_platform_s: platform || undefined,
    stream_type_s: streamType || undefined,
    stream_description_txt: description || undefined,
    stream_match_label_txt: matchLabel || undefined,
    stream_is_live_b: Boolean(stream?.isLive === true),
    stream_featured_b: Boolean(stream?.featured === true),
    stream_created_by_email_s: createdByEmail || undefined,
    stream_created_by_name_txt: createdByName || undefined,
    stream_created_at_dt: stream?.createdAt || undefined,
    stream_updated_at_dt: stream?.updatedAt || undefined,
    visible_to: ['public']
  };
}

module.exports = { mapStreamToSolrDoc };

