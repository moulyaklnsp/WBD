const safeTrim = (value) => (value == null ? '' : String(value)).trim();

const normalizeEmail = (value) => safeTrim(value).toLowerCase();

const isValidName = (name) => !!name && /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name);

const isSelfDeletedUser = (user) => {
  const email = normalizeEmail(user?.email);
  const deletedBy = normalizeEmail(user?.deleted_by);
  return Boolean(email && deletedBy && email === deletedBy);
};

const createAuthError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const requireOrganizer = (user) => {
  if (!user?.email) throw createAuthError('Unauthorized', 401);
  if (!user?.role) throw createAuthError('Forbidden', 403);
  if (user.role !== 'organizer') throw createAuthError('Forbidden', 403);
};

module.exports = {
  safeTrim,
  normalizeEmail,
  isValidName,
  isSelfDeletedUser,
  requireOrganizer
};
