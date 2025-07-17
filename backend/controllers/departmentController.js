const Department = require('../models/Department');
const Teacher = require('../models/Teacher');
const { validationResult } = require('express-validator');

// @desc    Create a new department
// @route   POST /api/departments
// @access  Private/Admin
exports.createDepartment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const department = new Department(req.body);
    await department.save();
    res.status(201).json(department);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Department with this code already exists' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const departments = await Department.find(filter)
      .populate('headId', 'shortName fullName')
      .sort({ code: 1 });
      
    res.json(departments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get department by ID
// @route   GET /api/departments/:id
// @access  Private
exports.getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headId', 'shortName fullName email designation');
    
    if (!department) {
      return res.status(404).json({ msg: 'Department not found' });
    }

    // Get department statistics
    const teacherCount = await Teacher.countDocuments({ 
      departmentId: department._id, 
      isActive: true 
    });

    const result = {
      ...department.toObject(),
      statistics: {
        teacherCount
      }
    };

    res.json(result);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Department not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private/Admin
exports.updateDepartment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ msg: 'Department not found' });
    }

    // If updating headId, verify the teacher exists and belongs to this department
    if (req.body.headId) {
      const teacher = await Teacher.findOne({
        _id: req.body.headId,
        departmentId: req.params.id,
        isActive: true
      });
      
      if (!teacher) {
        return res.status(400).json({ 
          msg: 'Department head must be an active teacher in this department' 
        });
      }
    }

    department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('headId', 'shortName fullName');

    res.json(department);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Department not found' });
    }
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Department with this code already exists' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete department (soft delete)
// @route   DELETE /api/departments/:id
// @access  Private/Admin
exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ msg: 'Department not found' });
    }

    // Check if department has active teachers
    const activeTeachers = await Teacher.countDocuments({
      departmentId: req.params.id,
      isActive: true
    });

    if (activeTeachers > 0) {
      return res.status(400).json({ 
        msg: `Cannot delete department with ${activeTeachers} active teachers. Please reassign or deactivate teachers first.` 
      });
    }

    // Soft delete
    department.isActive = false;
    await department.save();

    res.json({ msg: 'Department deactivated successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Department not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get department teachers
// @route   GET /api/departments/:id/teachers
// @access  Private
exports.getDepartmentTeachers = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ msg: 'Department not found' });
    }

    const teachers = await Teacher.find({ 
      departmentId: req.params.id,
      isActive: true 
    }).select('shortName fullName email designation maxWeeklyHours');

    res.json(teachers);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Department not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
