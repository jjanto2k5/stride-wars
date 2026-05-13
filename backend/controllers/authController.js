import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';

// Helper: sign and return JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Strip password from response
  const userData = user.toObject();
  delete userData.password;

  res.status(statusCode).json({
    success: true,
    token,
    user: userData,
  });
};

// @route  POST /api/auth/register
// @access Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/auth/login
// @access Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @route POST /api/auth/forgot-password
// @access Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email, frontendUrl } = req.body;

    if (!email || !frontendUrl) {
      return res.status(400).json({
        success: false,
        message: 'Email and frontend URL are required',
      });
    }

    const user = await User.findOne({ email });

    // Don't reveal whether email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    const resetToken = user.generatePasswordResetToken();

    await user.save({ validateBeforeSave: false });

    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Stride Wars Password Reset</h2>
        <p>You requested a password reset.</p>
        <p>This link expires in 15 minutes.</p>
        <a
          href="${resetUrl}"
          style="
            display:inline-block;
            padding:12px 20px;
            background:#2563eb;
            color:white;
            text-decoration:none;
            border-radius:8px;
          "
        >
          Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Stride Wars Password Reset',
        html,
      });

      res.status(200).json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    } catch (mailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
      });
    }
  } catch (err) {
    next(err);
  }
};

// @route POST /api/auth/reset-password/:token
// @access Public
export const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    user.password = password;

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/auth/me
// @access Private
export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

// @route  PUT /api/auth/me
// @access Private
export const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'avatar', 'color'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};