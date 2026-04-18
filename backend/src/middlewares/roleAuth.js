// Role-based authentication middleware with JWT + session support
const { verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt');

/**
 * Authenticate user via JWT token or session.
 * JWT takes priority; falls back to session if no token is present.
 * Populates req.user with decoded JWT payload when token auth is used.
 */
const authenticateJWT = (req, res, next) => {
  const token = extractTokenFromHeader(req);
  
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      // Populate req.user from JWT
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        isSuperAdmin: Boolean(decoded.isSuperAdmin),
        username: decoded.username,
        college: decoded.college
      };
      // Also sync to session for backward compatibility
      if (req.session) {
        req.session.userID = decoded.userId;
        req.session.userEmail = decoded.email;
        req.session.userRole = decoded.role;
        req.session.username = decoded.username;
        req.session.userCollege = decoded.college;
        req.session.isSuperAdmin = Boolean(decoded.isSuperAdmin);
      }
      return next();
    }
    // Token present but invalid/expired – return 401 so frontend can refresh
    return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
  }
  
  // No token – fall back to session
  if (req.session && req.session.userEmail) {
    req.user = {
      userId: req.session.userID,
      email: req.session.userEmail,
      role: req.session.userRole,
      isSuperAdmin: Boolean(req.session.isSuperAdmin),
      username: req.session.username,
      college: req.session.userCollege
    };
    return next();
  }
  
  return res.status(401).json({ success: false, message: 'Authentication required', code: 'NO_AUTH' });
};

/**
 * Helper: get user role from JWT or session
 */
function getUserRole(req) {
  if (req.user && req.user.role) return req.user.role;
  if (req.session && req.session.userRole) return req.session.userRole;
  return null;
}

function getUserEmail(req) {
  if (req.user && req.user.email) return req.user.email;
  if (req.session && req.session.userEmail) return req.session.userEmail;
  return null;
}

const isAdmin = (req, res, next) => {
  // Try JWT first
  const token = extractTokenFromHeader(req);
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.role === 'admin') {
      req.user = decoded;
      if (req.session) {
        req.session.userRole = 'admin';
        req.session.userEmail = decoded.email;
        req.session.username = decoded.username;
        req.session.userID = decoded.userId;
        req.session.isSuperAdmin = Boolean(decoded.isSuperAdmin);
      }
      return next();
    }
    if (decoded && decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    // Token invalid/expired
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
  }

  // Fallback to session
  if (req.session && req.session.userRole === 'admin') return next();
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const headerRole = (req.get('x-dev-role') || '').toLowerCase();
  const headerEmail = req.get('x-dev-email');
  if (isDev && headerRole === 'admin' && headerEmail) {
    if (!req.session) {
      req.session = {};
    }
    req.session.userRole = 'admin';
    req.session.userEmail = headerEmail;
    req.session.username = req.session.username || headerEmail;
    return next();
  }
  return res.status(403).json({ success: false, message: 'Unauthorized' });
};

const isOrganizer = (req, res, next) => {
  const token = extractTokenFromHeader(req);
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.role === 'organizer') {
      req.user = decoded;
      if (req.session) {
        req.session.userRole = 'organizer';
        req.session.userEmail = decoded.email;
        req.session.username = decoded.username;
        req.session.userID = decoded.userId;
      }
      return next();
    }
    if (decoded && decoded.role !== 'organizer') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
  }

  if (req.session && req.session.userRole === 'organizer') return next();
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const headerRole = (req.get('x-dev-role') || '').toLowerCase();
  const headerEmail = req.get('x-dev-email');
  if (isDev && headerRole === 'organizer' && headerEmail) {
    if (!req.session) {
      req.session = {};
    }
    req.session.userRole = 'organizer';
    req.session.userEmail = headerEmail;
    req.session.username = req.session.username || headerEmail;
    return next();
  }
  return res.status(403).json({ success: false, message: 'Unauthorized' });
};

const isCoordinator = (req, res, next) => {
  const token = extractTokenFromHeader(req);
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.role === 'coordinator') {
      req.user = decoded;
      if (req.session) {
        req.session.userRole = 'coordinator';
        req.session.userEmail = decoded.email;
        req.session.username = decoded.username;
        req.session.userID = decoded.userId;
      }
      return next();
    }
    if (decoded && decoded.role !== 'coordinator') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
  }

  if (req.session && req.session.userRole === 'coordinator') return next();
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const headerRole = (req.get('x-dev-role') || '').toLowerCase();
  const headerEmail = req.get('x-dev-email');
  if (isDev && headerRole === 'coordinator' && headerEmail) {
    if (!req.session) {
      req.session = {};
    }
    req.session.userRole = 'coordinator';
    req.session.userEmail = headerEmail;
    req.session.username = req.session.username || headerEmail;
    return next();
  }
  return res.status(403).json({ success: false, message: 'Unauthorized' });
};

const isPlayer = (req, res, next) => {
  const token = extractTokenFromHeader(req);
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.role === 'player') {
      req.user = decoded;
      if (req.session) {
        req.session.userRole = 'player';
        req.session.userEmail = decoded.email;
        req.session.username = decoded.username;
        req.session.userID = decoded.userId;
      }
      return next();
    }
    if (decoded && decoded.role !== 'player') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
  }

  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const headerRole = (req.get('x-dev-role') || '').toLowerCase();
  const headerEmail = req.get('x-dev-email');
  const headerUsername = req.get('x-dev-username');
  if (isDev && headerRole === 'player' && headerEmail) {
    if (!req.session) {
      req.session = {};
    }
    req.session.userRole = 'player';
    req.session.userEmail = headerEmail;
    req.session.username = headerUsername || headerEmail.split('@')[0];
    console.log('DEV: isPlayer bypass enabled for', req.session.userEmail);
    return next();
  }
  if (req.session && req.session.userRole === 'player') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Unauthorized' });
};

const isAdminOrOrganizer = (req, res, next) => {
  const token = extractTokenFromHeader(req);
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded && (decoded.role === 'admin' || decoded.role === 'organizer')) {
      req.user = decoded;
      if (req.session) {
        req.session.userRole = decoded.role;
        req.session.userEmail = decoded.email;
        req.session.username = decoded.username;
        req.session.userID = decoded.userId;
      }
      return next();
    }
    if (decoded) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
  }

  if (req.session && (req.session.userRole === 'admin' || req.session.userRole === 'organizer')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Unauthorized' });
};

module.exports = {
  authenticateJWT,
  isAdmin,
  isOrganizer,
  isCoordinator,
  isPlayer,
  isAdminOrOrganizer,
  getUserRole,
  getUserEmail
};
