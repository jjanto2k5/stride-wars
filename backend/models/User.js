import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const achievementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  icon: String,
  unlockedAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // never returned in queries by default
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    avatar: {
      type: String,
      default: '',
    },

    // Player color shown on the territory map
    color: {
      type: String,
      default: () =>
        '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    },

    // Aggregate stats (updated after each run)
    stats: {
      totalDistance: { type: Number, default: 0 }, // meters
      totalDuration: { type: Number, default: 0 }, // seconds
      totalRuns: { type: Number, default: 0 },
      territoriesCaptured: { type: Number, default: 0 },
      territoriesLost: { type: Number, default: 0 },
      battlesWon: { type: Number, default: 0 },
      battlesLost: { type: Number, default: 0 },
      areaConquered: { type: Number, default: 0 }, // sq meters
    },

    powerCards: [
      {
        type: {
          type: String,
          enum: ['shield', 'speed', 'expand', 'attack'],
        },
        quantity: {
          type: Number,
          default: 0,
        },
      },
    ],

    achievements: [achievementSchema],

    isActive: {
      type: Boolean,
      default: true,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Password reset fields
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// Compare entered password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  // raw token sent in email
  const resetToken = crypto.randomBytes(32).toString('hex');

  // hashed token stored in DB
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // expires in 15 minutes
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

export default User;