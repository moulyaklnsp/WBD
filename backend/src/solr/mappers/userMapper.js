const { normalizeKey } = require('../../utils/mongo');

function mapUserToSolrDoc(user) {
  const id = user?._id != null ? String(user._id) : '';
  const name = String(user?.name || user?.username || '').trim();
  const email = String(user?.email || '').trim().toLowerCase();
  const role = String(user?.role || '').trim().toLowerCase();
  const college = String(user?.college || '').trim();
  const isDeleted = Boolean(user?.isDeleted === 1 || user?.isDeleted === true);

  return {
    id: id ? `users:${id}` : undefined,
    user_role_s: role || undefined,
    user_name_txt: name || undefined,
    user_name_s: normalizeKey(name || email),
    user_username_s: String(user?.username || '').trim() || undefined,
    user_email_s: email || undefined,
    user_college_s: college || undefined,
    user_is_deleted_b: isDeleted,
    visible_to: ['public'],
    updated_at_dt: user?.updatedAt || user?.updated_at || user?.updated_date || undefined,
    created_at_dt: user?.createdAt || user?.created_at || user?.created_date || undefined
  };
}

module.exports = { mapUserToSolrDoc };

