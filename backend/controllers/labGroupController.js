const LabGroup = require('../models/LabGroup');
const ProgramSemester = require('../models/ProgramSemester');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const { validationResult } = require('express-validator');

// @desc    Create a new lab group
// @route   POST /api/lab-groups
// @access  Private/Admin
exports.createLabGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const labGroup = new LabGroup(req.body);
    await labGroup.save();
    
    // Populate references for response
    await labGroup.populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name' },
      { path: 'academicYearId', select: 'title nepaliYear' }
    ]);
    
    res.status(201).json(labGroup);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Lab group for this program/subject/semester/section already exists' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all lab groups
// @route   GET /api/lab-groups
// @access  Private
exports.getLabGroups = async (req, res) => {
  try {
    const { programId, semester, section, academicYearId, isActive } = req.query;
    const filter = {};
    
    if (programId) filter.programId = programId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (academicYearId) filter.academicYearId = academicYearId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const labGroups = await LabGroup.find(filter)
      .populate('programId', 'code name')
      .populate('subjectId', 'code name')
      .populate('academicYearId', 'title nepaliYear')
      .populate('groups.teacherId', 'shortName fullName')
      .sort({ semester: 1, section: 1 });
      
    res.json(labGroups);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get lab group by ID
// @route   GET /api/lab-groups/:id
// @access  Private
exports.getLabGroupById = async (req, res) => {
  try {
    const labGroup = await LabGroup.findById(req.params.id)
      .populate('programId', 'code name sections')
      .populate('subjectId', 'code name credits weeklyHours')
      .populate('academicYearId', 'title nepaliYear')
      .populate('groups.teacherId', 'shortName fullName email designation');
    
    if (!labGroup) {
      return res.status(404).json({ msg: 'Lab group not found' });
    }

    res.json(labGroup);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Lab group not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update lab group
// @route   PUT /api/lab-groups/:id
// @access  Private/Admin
exports.updateLabGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let labGroup = await LabGroup.findById(req.params.id);
    
    if (!labGroup) {
      return res.status(404).json({ msg: 'Lab group not found' });
    }

    // Validate teacher assignments if updating groups
    if (req.body.groups) {
      for (const group of req.body.groups) {
        if (group.teacherId) {
          const teacher = await Teacher.findOne({
            _id: group.teacherId,
            isActive: true
          });
          
          if (!teacher) {
            return res.status(400).json({ 
              msg: `Teacher ${group.teacherId} not found or inactive` 
            });
          }
        }
      }
    }

    labGroup = await LabGroup.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'programId', select: 'code name' },
      { path: 'subjectId', select: 'code name' },
      { path: 'groups.teacherId', select: 'shortName fullName' }
    ]);

    res.json(labGroup);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Lab group not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete lab group
// @route   DELETE /api/lab-groups/:id
// @access  Private/Admin
exports.deleteLabGroup = async (req, res) => {
  try {
    const labGroup = await LabGroup.findById(req.params.id);
    
    if (!labGroup) {
      return res.status(404).json({ msg: 'Lab group not found' });
    }

    // Check if lab group is referenced in routine slots
    const RoutineSlot = require('../models/RoutineSlot');
    const routineSlots = await RoutineSlot.countDocuments({
      labGroupId: req.params.id,
      isActive: true
    });

    if (routineSlots > 0) {
      return res.status(400).json({ 
        msg: `Cannot delete lab group. It is referenced in ${routineSlots} routine slots.` 
      });
    }

    await LabGroup.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Lab group deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Lab group not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Auto-create lab groups for a program semester
// @route   POST /api/lab-groups/auto-create
// @access  Private/Admin
exports.autoCreateLabGroups = async (req, res) => {
  try {
    const { programId, semester, academicYearId } = req.body;
    
    if (!programId || !semester || !academicYearId) {
      return res.status(400).json({ 
        msg: 'Program ID, semester, and academic year ID are required' 
      });
    }

    // Get program semester with lab subjects
    const programSemester = await ProgramSemester.findOne({
      programId,
      semester,
      academicYearId,
      isActive: true
    }).populate('subjects.subjectId');

    if (!programSemester) {
      return res.status(404).json({ msg: 'Program semester not found' });
    }

    const labSubjects = programSemester.subjects.filter(s => 
      s.subjectId && s.subjectId.requiresLab && s.requiresLab
    );

    if (labSubjects.length === 0) {
      return res.status(400).json({ 
        msg: 'No lab subjects found for this program semester' 
      });
    }

    const createdLabGroups = [];
    
    // Create lab groups for each section and lab subject
    const sections = ['AB', 'CD']; // Default sections
    
    for (const section of sections) {
      for (const labSubject of labSubjects) {
        const existingLabGroup = await LabGroup.findOne({
          programId,
          subjectId: labSubject.subjectId._id,
          semester,
          section,
          academicYearId
        });

        if (!existingLabGroup) {
          const labGroupCount = labSubject.labGroupCount || 2;
          const groups = [];
          
          for (let i = 1; i <= labGroupCount; i++) {
            groups.push({
              name: `G${i}`,
              studentCount: Math.ceil(40 / labGroupCount), // Approximate
              weekPattern: i % 2 === 1 ? 'odd' : 'even'
            });
          }

          const labGroup = new LabGroup({
            programId,
            subjectId: labSubject.subjectId._id,
            academicYearId,
            semester,
            section,
            totalGroups: labGroupCount,
            groups,
            display: {
              programCode: programSemester.programCode,
              subjectCode: labSubject.subjectId.code,
              subjectName: labSubject.subjectId.name
            }
          });

          await labGroup.save();
          createdLabGroups.push(labGroup);
        }
      }
    }

    res.status(201).json({
      msg: `Created ${createdLabGroups.length} lab groups`,
      labGroups: createdLabGroups
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
