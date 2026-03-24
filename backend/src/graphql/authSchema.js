const { buildSchema } = require('graphql');
const { connectDB } = require('../config/database');
const AuthService = require('../services/authService');
const AuthApiService = require('../services/authApiService');

const schema = buildSchema(`
  type AuthUser {
    id: ID!
    email: String!
    role: String!
    username: String!
    college: String
  }

  type SessionInfo {
    userEmail: String
    userRole: String
    username: String
    userId: String
    college: String
    authenticated: Boolean!
  }

  type FieldError {
    field: String!
    message: String!
  }

  type GenericResponse {
    success: Boolean!
    message: String
    code: String
    redirectUrl: String
  }

  type SignupResponse {
    success: Boolean!
    message: String
    errors: [FieldError!]
  }

  type AuthResponse {
    success: Boolean!
    message: String
    code: String
    redirectUrl: String
    accessToken: String
    refreshToken: String
    expiresIn: Int
    user: AuthUser
    restoreRequired: Boolean
    deletedUserId: String
    deletedUserRole: String
  }

  type VerifyOtpResponse {
    success: Boolean!
    message: String
    resetToken: String
  }

  type ThemeResponse {
    success: Boolean!
    theme: String
    message: String
  }

  type ContactQuery {
    id: ID!
    name: String
    email: String
    message: String
    submission_date: String
    status: String
    internal_note: String
    status_updated_at: String
  }

  type ContactQueriesResponse {
    success: Boolean!
    message: String
    queries: [ContactQuery!]
  }

  input SignupInput {
    name: String!
    dob: String!
    gender: String!
    college: String!
    email: String!
    phone: String!
    password: String!
    role: String!
    aicf_id: String
    fide_id: String
  }

  input RestoreAccountInput {
    id: ID!
    email: String!
    password: String!
  }

  input ResetPasswordInput {
    email: String!
    resetToken: String!
    newPassword: String!
    confirmPassword: String!
  }

  input ContactInput {
    name: String!
    email: String!
    message: String!
  }

  type Query {
    me: SessionInfo
    checkToken: SessionInfo
    myContactQueries: ContactQueriesResponse
    theme: ThemeResponse
  }

  type Mutation {
    signup(input: SignupInput!): SignupResponse
    verifySignupOtp(email: String!, otp: String!): AuthResponse
    login(email: String!, password: String!): AuthResponse
    logout(refreshToken: String): GenericResponse
    refreshToken(refreshToken: String!): AuthResponse
    revokeAllTokens: GenericResponse
    restoreAccount(input: RestoreAccountInput!): GenericResponse
    verifyReactivationOtp: GenericResponse
    forgotPassword(email: String!): GenericResponse
    verifyForgotPasswordOtp(email: String!, otp: String!): VerifyOtpResponse
    resetPassword(input: ResetPasswordInput!): GenericResponse
    contactus(input: ContactInput!): GenericResponse
    setTheme(theme: String!): GenericResponse
  }
`);

function mapFieldErrors(errors) {
  if (!errors) return null;
  return Object.entries(errors).map(([field, message]) => ({ field, message: String(message) }));
}

function formatAuthError(err) {
  return {
    success: false,
    message: err.message || 'Unexpected server error',
    code: err.code,
    restoreRequired: err.restoreRequired || false,
    deletedUserId: err.deletedUserId || null,
    deletedUserRole: err.deletedUserRole || null
  };
}

const rootValue = {
  // Queries
  me: (_args, context) => AuthService.getSession(context.req),
  checkToken: (_args, context) => AuthService.getSession(context.req),
  myContactQueries: async (_args, context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.getMyContactQueries(db, context.req.session);
      const queries = (result.queries || []).map((q) => ({
        id: q._id?.toString() || '',
        name: q.name,
        email: q.email,
        message: q.message,
        submission_date: q.submission_date ? new Date(q.submission_date).toISOString() : null,
        status: q.status,
        internal_note: q.internal_note,
        status_updated_at: q.status_updated_at ? new Date(q.status_updated_at).toISOString() : null
      }));
      return { success: true, queries };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to fetch your contact queries.' };
    }
  },
  theme: async (_args, context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.getTheme(db, context.req.session);
      return { success: true, theme: result.theme };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to load theme' };
    }
  },

  // Mutations
  signup: async ({ input }, _context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.apiSignup(db, input);
      return { success: true, message: result.message };
    } catch (err) {
      return { success: false, message: err.message || 'Unexpected server error', errors: mapFieldErrors(err.errors) };
    }
  },
  verifySignupOtp: async ({ email, otp }, context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.verifySignupOtp(db, { email, otp }, context.req.session);
      return {
        success: true,
        redirectUrl: result.redirectUrl,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user
      };
    } catch (err) {
      return formatAuthError(err);
    }
  },
  login: async ({ email, password }, context) => {
    try {
      const db = await connectDB();
      const result = await AuthService.login(db, email, password, context.req.session);
      return {
        success: true,
        redirectUrl: result.redirectUrl,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        user: result.user
      };
    } catch (err) {
      return formatAuthError(err);
    }
  },
  logout: async ({ refreshToken }, context) => {
    try {
      const db = await connectDB();
      await AuthService.logout(db, refreshToken, context.req.session);
      return { success: true, message: 'Logged out successfully' };
    } catch (err) {
      return { success: true, message: 'Logged out' };
    }
  },
  refreshToken: async ({ refreshToken }, context) => {
    if (!refreshToken) {
      return { success: false, message: 'Refresh token is required', code: 'NO_REFRESH_TOKEN' };
    }
    try {
      const db = await connectDB();
      const result = await AuthService.rotateRefreshToken(db, refreshToken, context.req.session);
      return {
        success: true,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        user: result.user
      };
    } catch (err) {
      return { success: false, message: err.message || 'Server error', code: err.code };
    }
  },
  revokeAllTokens: async (_args, context) => {
    try {
      const db = await connectDB();
      await AuthService.revokeAllTokens(db, context.req);
      return { success: true, message: 'All sessions revoked' };
    } catch (err) {
      return { success: false, message: err.message || 'Server error' };
    }
  },
  restoreAccount: async ({ input }, context) => {
    try {
      const db = await connectDB();
      const result = await AuthService.restoreAccount(db, input, context.req.session);
      return { success: true, message: 'Account restored successfully!', code: null, redirectUrl: result.redirectUrl };
    } catch (err) {
      return { success: false, message: err.message || 'Unexpected server error' };
    }
  },
  verifyReactivationOtp: () => {
    try {
      AuthApiService.verifyReactivationOtp();
      return { success: true, message: 'OK' };
    } catch (err) {
      return { success: false, message: err.message || 'Reactivation OTP flow has been removed. Please use Restore Account.' };
    }
  },
  forgotPassword: async ({ email }, _context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.forgotPassword(db, { email });
      return { success: true, message: result.message };
    } catch (err) {
      return { success: false, message: err.message || 'Server error. Please try again.' };
    }
  },
  verifyForgotPasswordOtp: async ({ email, otp }, _context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.verifyForgotPasswordOtp(db, { email, otp });
      return { success: true, message: result.message, resetToken: result.resetToken };
    } catch (err) {
      return { success: false, message: err.message || 'Server error. Please try again.' };
    }
  },
  resetPassword: async ({ input }, _context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.resetPassword(db, input);
      return { success: true, message: result.message };
    } catch (err) {
      return { success: false, message: err.message || 'Server error. Please try again.' };
    }
  },
  contactus: async ({ input }, context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.apiContactus(db, input, context.req.session);
      return { success: true, message: result.message };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to send message.' };
    }
  },
  setTheme: async ({ theme }, context) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.setTheme(db, { theme }, context.req.session);
      return { success: true, message: result.message || 'Theme saved' };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to save theme' };
    }
  }
};

function buildContext(req, res) {
  return { req, res, auth: AuthService.getSession(req) };
}

module.exports = {
  schema,
  rootValue,
  buildContext
};
