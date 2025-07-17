const ElectiveGroup = require('../models/ElectiveGroup');
const SectionElectiveChoice = require('../models/SectionElectiveChoice');
const Subject = require('../models/Subject');
const Program = require('../models/Program');
const { validationResult } = require('express-validator');

// @desc    Create a new elective group
// @route   POST /api/elective-groups
// @access  Private/Admin
exports.createElectiveGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const electiveGroup = new ElectiveGroup(req.body);
    await electiveGroup.save();
    
    // Populate references for response
    await electiveGroup.populate([
      { path: 'programId', select: 'code name' },
      { path: 'academicYearId', select: 'title nepaliYear' },
      { path: 'subjects.subjectId', select: 'code name credits' }
    ]);
    
    res.status(201).json(electiveGroup);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Elective group with this code already exists for this program/semester/year' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all elective groups
// @route   GET /api/elective-groups
// @access  Private
exports.getElectiveGroups = async (req, res) => {
  try {
    const { programId, semester, academicYearId, isActive } = req.query;
    const filter = {};
    
    if (programId) filter.programId = programId;
    if (semester) filter.semester = parseInt(semester);
    if (academicYearId) filter.academicYearId = academicYearId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const electiveGroups = await ElectiveGroup.find(filter)
      .populate('programId', 'code name')
      .populate('academicYearId', 'title nepaliYear')
      .populate('subjects.subjectId', 'code name credits weeklyHours')
      .sort({ semester: 1, name: 1 });
      
    res.json(electiveGroups);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get elective group by ID
// @route   GET /api/elective-groups/:id
// @access  Private
exports.getElectiveGroupById = async (req, res) => {
  try {
    const electiveGroup = await ElectiveGroup.findById(req.params.id)
      .populate('programId', 'code name sections')
      .populate('academicYearId', 'title nepaliYear')
      .populate('subjects.subjectId', 'code name description credits weeklyHours prerequisites');
    
    if (!electiveGroup) {
      return res.status(404).json({ msg: 'Elective group not found' });
    }

    // Get selection statistics
    const selectionStats = await SectionElectiveChoice.aggregate([
      {
        $match: {
          'choices.electiveGroupId': electiveGroup._id,
          status: 'Approved'
        }
      },
      {
        $unwind: '$choices'
      },
      {
        $match: {
          'choices.electiveGroupId': electiveGroup._id
        }
      },
      {
        $group: {
          _id: '$choices.selectedSubjectId',
          subjectCode: { $first: '$choices.subjectCode' },
          subjectName: { $first: '$choices.subjectName' },
          sectionCount: { $sum: 1 }
        }
      }
    ]);

    const result = {
      ...electiveGroup.toObject(),
      selectionStatistics: selectionStats
    };

    res.json(result);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Elective group not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update elective group
// @route   PUT /api/elective-groups/:id
// @access  Private/Admin
exports.updateElectiveGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let electiveGroup = await ElectiveGroup.findById(req.params.id);
    
    if (!electiveGroup) {
      return res.status(404).json({ msg: 'Elective group not found' });
    }

    // Validate subject references if updating subjects
    if (req.body.subjects) {
      for (const subjectEntry of req.body.subjects) {
        if (subjectEntry.subjectId) {
          const subject = await Subject.findOne({
            _id: subjectEntry.subjectId,
            isActive: true
          });
          
          if (!subject) {
            return res.status(400).json({ 
              msg: `Subject ${subjectEntry.subjectId} not found or inactive` 
            });
          }
        }
      }
    }

    electiveGroup = await ElectiveGroup.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'programId', select: 'code name' },
      { path: 'academicYearId', select: 'title nepaliYear' },
      { path: 'subjects.subjectId', select: 'code name credits' }
    ]);

    res.json(electiveGroup);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Elective group not found' });
    }
    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Elective group with this code already exists' 
      });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete elective group
// @route   DELETE /api/elective-groups/:id
// @access  Private/Admin
exports.deleteElectiveGroup = async (req, res) => {
  try {
    const electiveGroup = await ElectiveGroup.findById(req.params.id);
    
    if (!electiveGroup) {
      return res.status(404).json({ msg: 'Elective group not found' });
    }

    // Check if elective group is referenced in section choices
    const sectionChoices = await SectionElectiveChoice.countDocuments({
      'choices.electiveGroupId': req.params.id
    });

    if (sectionChoices > 0) {
      return res.status(400).json({ 
        msg: `Cannot delete elective group. It is referenced in ${sectionChoices} section choices.` 
      });
    }

    await ElectiveGroup.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Elective group deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Elective group not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Add subject to elective group
// @route   POST /api/elective-groups/:id/subjects
// @access  Private/Admin
exports.addSubjectToElectiveGroup = async (req, res) => {
  try {
    const { subjectId, maxSections } = req.body;
    
    if (!subjectId) {
      return res.status(400).json({ msg: 'Subject ID is required' });
    }

    const electiveGroup = await ElectiveGroup.findById(req.params.id);
    
    if (!electiveGroup) {
      return res.status(404).json({ msg: 'Elective group not found' });
    }

    // Check if subject exists and is active
    const subject = await Subject.findOne({ _id: subjectId, isActive: true });
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found or inactive' });
    }

    // Check if subject is already in the group
    const existingSubject = electiveGroup.subjects.find(s => 
      s.subjectId.toString() === subjectId
    );
    
    if (existingSubject) {
      return res.status(400).json({ msg: 'Subject already exists in this elective group' });
    }

    // Add subject to group
    electiveGroup.subjects.push({
      subjectId,
      subjectCode: subject.code,
      subjectName: subject.name,
      maxSections: maxSections || 2,
      isAvailable: true
    });

    await electiveGroup.save();
    await electiveGroup.populate('subjects.subjectId', 'code name credits');

    res.json(electiveGroup);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Invalid ID format' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Remove subject from elective group
// @route   DELETE /api/elective-groups/:id/subjects/:subjectId
// @access  Private/Admin
exports.removeSubjectFromElectiveGroup = async (req, res) => {
  try {
    const electiveGroup = await ElectiveGroup.findById(req.params.id);
    
    if (!electiveGroup) {
      return res.status(404).json({ msg: 'Elective group not found' });
    }

    // Check if subject is selected by any section
    const isSelected = await SectionElectiveChoice.findOne({
      'choices.electiveGroupId': req.params.id,
      'choices.selectedSubjectId': req.params.subjectId,
      status: { $in: ['Submitted', 'Approved'] }
    });

    if (isSelected) {
      return res.status(400).json({ 
        msg: 'Cannot remove subject that has been selected by sections' 
      });
    }

    await electiveGroup.save();
    await electiveGroup.populate('subjects.subjectId', 'code name credits');

    res.json(electiveGroup);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Invalid ID format' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get elective groups by program code
// @route   GET /api/elective-groups/program/:programCode
// @access  Private
exports.getElectivesByProgram = async (req, res) => {
  try {
    const { programCode } = req.params;
    const { semester, academicYearId, isActive } = req.query;
    
    // Find program by code
    const program = await Program.findOne({ code: programCode });
    if (!program) {
      return res.status(404).json({ msg: 'Program not found' });
    }
    
    const filter = { programId: program._id };
    
    if (semester) filter.semester = parseInt(semester);
    if (academicYearId) filter.academicYearId = academicYearId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const electiveGroups = await ElectiveGroup.find(filter)
      .populate('programId', 'code name')
      .populate('academicYearId', 'title nepaliYear')
      .populate('subjects.subjectId', 'code name credits weeklyHours')
      .sort({ semester: 1, name: 1 });
      
    res.json(electiveGroups);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
