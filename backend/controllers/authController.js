import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Run from '../models/Run.js';
import Territory from '../models/Territory.js';
import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  const userData = user.toObject();
  delete userData.password;

  res.status(statusCode).json({ success: true, token, user: userData });
};

// @route  POST /api/auth/register
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

// @route  POST /api/auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email, frontendUrl } = req.body;

    if (!email || !frontendUrl) {
      return res.status(400).json({ success: false, message: 'Email and frontend URL are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Stride Wars Password Reset</h2>
        <p>You requested a password reset for your commander profile.</p>
        <p>This link expires in 15 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block; padding:12px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:8px;">
          Reset Password
        </a>
        <p>If you didn't request this, please safely ignore this email.</p>
      </div>
    `;

    try {
      await sendEmail({ to: user.email, subject: 'Stride Wars Password Reset', html });
      res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (mailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, message: 'Failed to send email' });
    }
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/auth/reset-password/:token
export const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/auth/me
export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

// @route  PUT /api/auth/me
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

// @route  DELETE /api/auth/me
export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Run.deleteMany({ user: userId });

    await Territory.updateMany(
      { owner: userId },
      { $unset: { owner: 1 }, $set: { color: '#6b7280', defenseScore: 0 } }
    );

    await Territory.updateMany(
      {},
      { $pull: { previousOwners: { user: userId }, battleHistory: { challenger: userId } } }
    );

    await User.findByIdAndDelete(userId);

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};