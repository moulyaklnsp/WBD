/**
 * Auth API Service
 * Shared business logic for Auth API flows used by REST controllers and GraphQL resolvers.
 */
const bcrypt = require('bcryptjs');
const { sendOtpEmail, sendForgotPasswordOtp } = require('./emailService');
const { generateTokenPair } = require('../utils/jwt');
const { normalizeKey } = require('../utils/mongo');

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

function createError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const AuthApiService = {
  async apiSignup(db, payload) {
    const { name, dob, gender, college, email, phone, password, role, aicf_id, fide_id } = payload || {};
    let errors = {};

    if (!name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) errors.name = 'Valid full name is required (letters only)';
    if (!dob) errors.dob = 'Date of Birth is required';
    else {
      const birthDate = new Date(dob);
      const age = Math.floor((Date.now() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 16) errors.dob = 'You must be at least 16 years old';
    }
    if (!gender || !['male', 'female', 'other'].includes(gender)) errors.gender = 'Gender is required';
    if (!college || !/^[A-Za-z\s']+$/.test((college || '').trim())) errors.college = 'College name must contain only letters, spaces, or apostrophes';
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Valid email is required';
    else if (/[A-Z]/.test(email)) errors.email = 'Email should only contain lowercase letters';
    if (!phone || !/^[0-9]{10}$/.test(phone)) errors.phone = 'Valid 10-digit phone number is required';
    if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (!role || !['organizer', 'coordinator', 'player'].includes(role)) {
      errors.role = 'Valid role is required';
    }
    if (role === 'admin') {
      errors.role = 'Admin signup is disabled. Please request an invite.';
    }

    if (Object.keys(errors).length > 0) {
      console.log('Signup validation errors (API):', errors);
      throw createError('Validation failed', 400, { errors });
    }

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      console.log('Signup failed (API): Email already exists:', email);
      throw createError('Email already registered', 409);
    }
    if (role === 'coordinator' && college) {
      const collegeKey = normalizeKey(college);
      
      const activeCoordinator = await db.collection('users').findOne({
        role: 'coordinator',
        isDeleted: { $ne: 1 },
        college_key: collegeKey
      });
      if (activeCoordinator) {
        throw createError('Already a coordinator exists from this college', 409);
      }

      const pendingCoordinatorReq = await db.collection('pending_coordinators').findOne({
        'data.college_key': collegeKey,
        status: 'pending'
      });
      if (pendingCoordinatorReq) {
        throw createError('A coordinator signup request is already pending for this college', 409);
      }
    }
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const signupData = {
      name,
      dob: new Date(dob),
      gender,
      college,
      college_key: normalizeKey(college),
      email,
      phone,
      password: hashedPassword,
      role,
      isSuperAdmin: false,
      aicf_id: aicf_id || '',
      fide_id: fide_id || ''
    };
    if (role === 'coordinator') {
      // Store in pending approvals instead of generating OTP immediately
      await db.collection('pending_coordinators').insertOne({
        email,
        data: signupData,
        status: 'pending',
        created_at: new Date()
      });
      // Notify all organizers via socket
      const io = require('./socketService').getIO();
      if (io) {
        io.to('organizer_room').emit('new_coordinator_request', { email, name, college });
      }
      return { message: 'Signup request sent for approval. Please wait...', pendingApproval: true };
    }

    await db.collection('signup_otps').insertOne({
      email,
      data: signupData,
      created_at: new Date()
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.collection('otps').insertOne({
      email,
      otp,
      type: 'signup',
      expires_at: expiresAt,
      used: false
    });

    console.log(`Generated OTP for ${email}: ${otp}`);
    await sendOtpEmail(email, otp);

    return { message: 'OTP sent to your email for verification' };
  },

  async verifySignupOtp(db, { email, otp }, session) {
    if (!email || !otp) throw createError('Email and OTP required', 400);

    const otpRecord = await db.collection('otps').findOne({ email, otp, type: 'signup', used: false });
    if (!otpRecord) throw createError('Invalid OTP', 400);
    if (new Date() > otpRecord.expires_at) throw createError('OTP expired', 400);

    await db.collection('otps').updateOne({ _id: otpRecord._id }, { $set: { used: true } });

    const signupRecord = await db.collection('signup_otps').findOne({ email });
    if (!signupRecord) throw createError('Signup data not found', 400);

    const storedPassword = signupRecord?.data?.password || '';
    const passwordToStore = isBcryptHash(storedPassword)
      ? storedPassword
      : await bcrypt.hash(storedPassword, BCRYPT_ROUNDS);

    const user = {
      ...signupRecord.data,
      password: passwordToStore,
      isDeleted: 0,
      isSuperAdmin: false,
      AICF_ID: signupRecord.data.aicf_id || '',
      FIDE_ID: signupRecord.data.fide_id || ''
    };

    const result = await db.collection('users').insertOne(user);
    const userId = result.insertedId;

    await db.collection('signup_otps').deleteOne({ _id: signupRecord._id });

    if (user.role === 'player') {
      await db.collection('user_balances').insertOne({ user_id: userId, wallet_balance: 0 });
    }

    if (session) {
      session.userID = userId;
      session.userEmail = user.email;
      session.userRole = user.role;
      session.username = user.name;
      session.playerName = user.name;
      session.userCollege = user.college;
      session.collegeName = user.college;
      session.isSuperAdmin = false;
    }

    const userWithId = { ...user, _id: userId };
    const tokens = generateTokenPair(userWithId);

    await db.collection('refresh_tokens').insertOne({
      userId: userId,
      email: user.email,
      token: tokens.refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revoked: false
    });

    let redirectUrl = '';
    switch (user.role) {
      case 'admin': redirectUrl = '/admin/admin_dashboard'; break;
      case 'organizer': redirectUrl = '/organizer/organizer_dashboard'; break;
      case 'coordinator': redirectUrl = '/coordinator/coordinator_dashboard'; break;
      case 'player': redirectUrl = '/player/player_dashboard?success-message=Player Signup Successful'; break;
      default: throw createError('Invalid Role', 400);
    }

    return {
      redirectUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: userId.toString(),
        email: user.email,
        role: user.role,
        isSuperAdmin: false,
        username: user.name,
        college: user.college
      }
    };
  },

  async forgotPassword(db, { email }) {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw createError('Valid email is required', 400);
    }

    const user = await db.collection('users').findOne({ email: email.toLowerCase(), isDeleted: { $ne: 1 } });
    if (!user) {
      throw createError('No account found with this email address', 404);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection('otps').deleteMany({ email: email.toLowerCase(), type: 'forgot-password' });

    await db.collection('otps').insertOne({
      email: email.toLowerCase(),
      otp,
      type: 'forgot-password',
      expires_at: expiresAt,
      used: false,
      created_at: new Date()
    });

    console.log(`Generated Forgot Password OTP for ${email}: ${otp}`);
    await sendForgotPasswordOtp(email.toLowerCase(), otp);

    return { message: 'OTP sent to your email address' };
  },

  async verifyForgotPasswordOtp(db, { email, otp }) {
    if (!email || !otp) {
      throw createError('Email and OTP are required', 400);
    }

    const otpRecord = await db.collection('otps').findOne({
      email: email.toLowerCase(),
      otp,
      type: 'forgot-password',
      used: false
    });

    if (!otpRecord) throw createError('Invalid OTP', 400);
    if (new Date() > otpRecord.expires_at) {
      throw createError('OTP has expired. Please request a new one.', 400);
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await db.collection('otps').updateOne(
      { _id: otpRecord._id },
      { $set: { used: true, resetToken, resetTokenExpiry } }
    );

    return {
      message: 'OTP verified successfully. You can now reset your password.',
      resetToken
    };
  },

  async resetPassword(db, { email, resetToken, newPassword, confirmPassword }) {
    if (!email || !resetToken || !newPassword || !confirmPassword) {
      throw createError('All fields are required', 400);
    }
    if (newPassword !== confirmPassword) {
      throw createError('Passwords do not match', 400);
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(newPassword)) {
      throw createError(
        'Password must be at least 8 characters with one uppercase, one lowercase, and one special character',
        400
      );
    }

    const otpRecord = await db.collection('otps').findOne({
      email: email.toLowerCase(),
      type: 'forgot-password',
      resetToken,
      used: true
    });

    if (!otpRecord) {
      throw createError('Invalid or expired reset token. Please start over.', 400);
    }
    if (new Date() > otpRecord.resetTokenExpiry) {
      throw createError('Reset token has expired. Please start over.', 400);
    }

    const user = await db.collection('users').findOne({ email: email.toLowerCase(), isDeleted: { $ne: 1 } });
    if (!user) throw createError('User not found', 404);

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    await db.collection('otps').deleteOne({ _id: otpRecord._id });

    console.log(`Password reset successful for user: ${email}`);
    return { message: 'Password reset successful! You can now login with your new password.' };
  },

  async apiContactus(db, payload, session) {
    const { name, email, message } = payload || {};
    let errors = {};
    if (!name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
      errors.name = 'Name should only contain letters';
    }
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!message || message.trim() === '') {
      errors.message = 'Message cannot be empty';
    } else {
      const wordCount = message.trim().split(/\s+/).length;
      if (wordCount > 200) errors.message = 'Message cannot exceed 200 words';
    }
    if (Object.keys(errors).length > 0) {
      throw createError('Validation failed', 400, { errors });
    }

    const sessionEmail = String(session?.userEmail || '').trim().toLowerCase();
    await db.collection('contact').insertOne({
      name,
      email,
      message,
      submission_date: new Date(),
      status: 'pending',
      submitted_by: sessionEmail || String(email || '').trim().toLowerCase()
    });

    return { message: 'Message sent successfully!' };
  },

  async getMyContactQueries(db, session) {
    const userEmail = String(session?.userEmail || '').trim().toLowerCase();
    if (!userEmail) {
      throw createError('Please log in to view your queries.', 401);
    }
    const queries = await db.collection('contact')
      .find({
        $or: [
          { submitted_by: userEmail },
          { email: userEmail }
        ]
      })
      .sort({ submission_date: -1 })
      .project({ name: 1, email: 1, message: 1, submission_date: 1, status: 1, internal_note: 1, status_updated_at: 1 })
      .limit(200)
      .toArray();

    return { queries };
  },

  async getTheme(db, session) {
    if (!session?.userEmail) return { theme: null };
    const user = await db.collection('users').findOne(
      { email: session.userEmail },
      { projection: { theme: 1 } }
    );
    const theme = (user && user.theme === 'dark') ? 'dark' : 'light';
    return { theme };
  },

  async setTheme(db, { theme }, session) {
    if (!session?.userEmail) throw createError('Not logged in', 401);
    if (!['dark', 'light'].includes(theme)) throw createError('Invalid theme value', 400);
    await db.collection('users').updateOne({ email: session.userEmail }, { $set: { theme } });
    return { message: 'Theme saved' };
  },

  verifyReactivationOtp() {
    throw createError('Reactivation OTP flow has been removed. Please use Restore Account.', 410);
  }
};

module.exports = AuthApiService;
