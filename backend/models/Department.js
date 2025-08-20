const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 10
      // e.g., "DOECE", "DOCE", "DOE"
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
      // Short name e.g., "Electronics & Computer"
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
      // Complete name e.g., "Department of Electronics & Computer Engineering"
    },
    headId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null
      // Current department head
    },
    
    // Contact Information
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100
      // Physical location
    },
    
    // Administrative
    isActive: {
      type: Boolean,
      default: true
    },
    establishedDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes as per data model specification
// Note: code field already has unique: true, so no need for explicit index
DepartmentSchema.index({ isActive: 1 });
DepartmentSchema.index({ name: 1 });

// Virtual for teacher count
DepartmentSchema.virtual('teacherCount', {
  ref: 'Teacher',
  localField: '_id',
  foreignField: 'departmentId',
  count: true
});

// Virtual for program count  
DepartmentSchema.virtual('programCount', {
  ref: 'Program',
  localField: '_id',
  foreignField: 'departmentId',
  count: true
});

// Instance method to get department head info
DepartmentSchema.methods.getHead = async function() {
  if (!this.headId) return null;
  
  return await mongoose.model('Teacher').findById(this.headId)
    .select('fullName shortName designation email');
};

// Static method to find by code
DepartmentSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), isActive: true });
};

// Pre-save validation
DepartmentSchema.pre('save', async function(next) {
  // Ensure department head belongs to this department
  if (this.headId && this.isModified('headId')) {
    const Teacher = mongoose.model('Teacher');
    const head = await Teacher.findById(this.headId);
    
    if (head && head.departmentId && !head.departmentId.equals(this._id)) {
      // Allow if this is a new department or the head is being transferred
      if (!this.isNew) {
        return next(new Error('Department head must belong to this department'));
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('Department', DepartmentSchema);
