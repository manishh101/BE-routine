const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ['admin', 'department_head', 'teacher', 'staff'],
      default: 'teacher',
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
      // Optional department association
    },
    isActive: {
      type: Boolean,
      default: true
    },
    preferences: {
      language: {
        type: String,
        enum: ['en', 'ne'],
        default: 'en'
      },
      timezone: {
        type: String,
        default: 'Asia/Kathmandu'
      }
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match entered password with hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    return false;
  }
};

// Update last login timestamp
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return await this.save();
};

// Check if user belongs to a department
UserSchema.methods.hasDepartment = function() {
  return this.departmentId != null;
};

// Indexes as per data model specification
// Note: email field already has unique: true, so no need for explicit index
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ departmentId: 1 });

// Business Rules Validation
UserSchema.pre('save', async function(next) {
  // Department heads must belong to a department
  if (this.role === 'department_head' && !this.departmentId) {
    return next(new Error('Department heads must belong to a department'));
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);
