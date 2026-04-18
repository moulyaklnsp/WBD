function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeRole(value) {
  const v = safeTrim(value).toLowerCase();
  if (['admin', 'organizer', 'coordinator', 'player', 'public', 'all'].includes(v)) return v;
  return '';
}

function visibleToFromTargetRole(targetRole) {
  const role = normalizeRole(targetRole);
  if (!role || role === 'all') return ['public'];
  if (role === 'public') return ['public'];
  return [role];
}

function mapAnnouncementToSolrDoc(announcement) {
  const id = announcement?._id != null ? String(announcement._id) : '';
  const title = safeTrim(announcement?.title);
  const message = safeTrim(announcement?.message);
  const targetRole = normalizeRole(announcement?.target_role);
  const isActive = Boolean(announcement?.is_active !== false);

  return {
    id: id ? `announcements:${id}` : undefined,
    announcement_title_txt: title || undefined,
    announcement_body_txt: message || undefined,
    announcement_target_role_ss: targetRole ? [targetRole] : undefined,
    announcement_is_active_b: isActive,
    announcement_posted_date_dt: announcement?.posted_date || undefined,
    visible_to: visibleToFromTargetRole(targetRole)
  };
}

module.exports = { mapAnnouncementToSolrDoc, visibleToFromTargetRole };

