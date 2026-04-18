function mapContactToSolrDoc(message) {
  const id = message?._id != null ? String(message._id) : '';
  const name = String(message?.name || '').trim();
  const email = String(message?.email || '').trim().toLowerCase();
  const status = String(message?.status || '').trim().toLowerCase();
  const body = String(message?.message || '').trim();
  const internalNote = String(message?.internal_note || '').trim();
  const submittedBy = String(message?.submitted_by || '').trim().toLowerCase();

  return {
    id: id ? `contact:${id}` : undefined,
    contact_status_s: status || undefined,
    contact_name_txt: name || undefined,
    contact_email_s: email || undefined,
    contact_message_txt: body || undefined,
    contact_internal_note_txt: internalNote || undefined,
    contact_submitted_by_s: submittedBy || undefined,
    contact_submission_date_dt: message?.submission_date || undefined,
    contact_status_updated_at_dt: message?.status_updated_at || undefined,
    visible_to: ['admin']
  };
}

module.exports = { mapContactToSolrDoc };

