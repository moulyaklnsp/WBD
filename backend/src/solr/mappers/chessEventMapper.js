function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function mapChessEventToSolrDoc(event) {
  const id = event?._id != null ? String(event._id) : '';
  const title = safeTrim(event?.title);
  const description = safeTrim(event?.description);
  const category = safeTrim(event?.category);
  const location = safeTrim(event?.location);
  const coordinatorId = safeTrim(event?.coordinatorId);

  return {
    id: id ? `chess_events:${id}` : undefined,
    chess_event_title_txt: title || undefined,
    chess_event_description_txt: description || undefined,
    chess_event_category_s: category || undefined,
    chess_event_location_txt: location || undefined,
    chess_event_date_dt: event?.date || undefined,
    chess_event_active_b: Boolean(event?.active !== false),
    chess_event_coordinator_id_s: coordinatorId || undefined,
    visible_to: ['public']
  };
}

module.exports = { mapChessEventToSolrDoc };

