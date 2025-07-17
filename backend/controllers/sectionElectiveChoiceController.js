const SectionElectiveChoice = require('../models/SectionElectiveChoice');
const ElectiveGroup = require('../models/ElectiveGroup');
const Subject = require('../models/Subject');
const Program = require('../models/Program');
const { validationResult } = require('express-validator');

// @desc    Create or update section elective choice
// @route   POST /api/section-elective-choices
// @access  Private/Admin
exports.createSectionElectiveChoice = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { programId, academicYearId, semester, section, choices } = req.body;

    // Check if choice already exists
    let sectionChoice = await SectionElectiveChoice.findOne({
      programId,
      academicYearId,
      semester,
      section
    });

    if (sectionChoice) {
      return res.status(400).json({ 
        msg: 'Section elective choice already exists. Use PUT to update.' 
      });
    }

    // Validate all choices
    for (const choice of choices) {
      const electiveGroup = await ElectiveGroup.findById(choice.electiveGroupId);
      if (!electiveGroup) {
        return res.status(400).json({ 
          msg: `Elective group ${choice.electiveGroupId} not found` 
        });
      }

      const subjectInGroup = electiveGroup.subjects.find(s => 
        s.subjectId.toString() === choice.selectedSubjectId
      );
      
      if (!subjectInGroup) {
        return res.status(400).json({ 
          msg: `Subject ${choice.selectedSubjectId} not available in elective group` 
        });
      }

      if (!subjectInGroup.isAvailable) {
        return res.status(400).json({ 
          msg: `Subject ${choice.selectedSubjectId} is not available for selection` 
        });
      }
    }

    // Create new section choice
    sectionChoice = new SectionElectiveChoice({
      programId,
      academicYearId,
      semester,
      section,
      choices: choices.map(choice => ({
        ...choice,
        selectedAt: new Date(),
        selectedBy: req.user.id // Assuming user info is in req.user
      })),
      status: 'Draft'
    });

    await sectionChoice.save();
    
    // Populate for response
    await sectionChoice.populate([
      { path: 'programId', select: 'code name' },
      { path: 'academicYearId', select: 'title nepaliYear' },
      { path: 'choices.electiveGroupId', select: 'name code' },
      { path: 'choices.selectedSubjectId', select: 'code name credits' }
    ]);

    res.status(201).json(sectionChoice);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get all section elective choices
// @route   GET /api/section-elective-choices
// @access  Private
exports.getSectionElectiveChoices = async (req, res) => {
  try {
    const { programId, academicYearId, semester, section, status } = req.query;
    const filter = {};
    
    if (programId) filter.programId = programId;
    if (academicYearId) filter.academicYearId = academicYearId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (status) filter.status = status;

    const sectionChoices = await SectionElectiveChoice.find(filter)
      .populate('programId', 'code name')
      .populate('academicYearId', 'title nepaliYear')
      .populate('choices.electiveGroupId', 'name code')
      .populate('choices.selectedSubjectId', 'code name credits weeklyHours')
      .sort({ programId: 1, semester: 1, section: 1 });

    res.json(sectionChoices);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get section elective choice by ID
// @route   GET /api/section-elective-choices/:id
// @access  Private
exports.getSectionElectiveChoiceById = async (req, res) => {
  try {
    const sectionChoice = await SectionElectiveChoice.findById(req.params.id)
      .populate('programId', 'code name sections')
      .populate('academicYearId', 'title nepaliYear')
      .populate('choices.electiveGroupId', 'name code rules')
      .populate('choices.selectedSubjectId', 'code name description credits weeklyHours');

    if (!sectionChoice) {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }

    res.json(sectionChoice);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Update section elective choice
// @route   PUT /api/section-elective-choices/:id
// @access  Private/Admin
exports.updateSectionElectiveChoice = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let sectionChoice = await SectionElectiveChoice.findById(req.params.id);
    
    if (!sectionChoice) {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }

    // Only allow updates if status is Draft or Rejected
    if (!['Draft', 'Rejected'].includes(sectionChoice.status)) {
      return res.status(400).json({ 
        msg: 'Cannot update choices that have been submitted or approved' 
      });
    }

    // Validate new choices if provided
    if (req.body.choices) {
      for (const choice of req.body.choices) {
        if (choice.electiveGroupId && choice.selectedSubjectId) {
          const electiveGroup = await ElectiveGroup.findById(choice.electiveGroupId);
          if (!electiveGroup) {
            return res.status(400).json({ 
              msg: `Elective group ${choice.electiveGroupId} not found` 
            });
          }

          const subjectInGroup = electiveGroup.subjects.find(s => 
            s.subjectId.toString() === choice.selectedSubjectId
          );
          
          if (!subjectInGroup || !subjectInGroup.isAvailable) {
            return res.status(400).json({ 
              msg: `Subject ${choice.selectedSubjectId} not available in elective group` 
            });
          }
        }
      }
    }

    sectionChoice = await SectionElectiveChoice.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'programId', select: 'code name' },
      { path: 'academicYearId', select: 'title nepaliYear' },
      { path: 'choices.electiveGroupId', select: 'name code' },
      { path: 'choices.selectedSubjectId', select: 'code name credits' }
    ]);

    res.json(sectionChoice);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Submit section elective choice for approval
// @route   PUT /api/section-elective-choices/:id/submit
// @access  Private/Admin
exports.submitSectionElectiveChoice = async (req, res) => {
  try {
    const sectionChoice = await SectionElectiveChoice.findById(req.params.id);
    
    if (!sectionChoice) {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }

    if (sectionChoice.status !== 'Draft') {
      return res.status(400).json({ 
        msg: 'Only draft choices can be submitted' 
      });
    }

    // Validate all required choices are made
    const program = await Program.findById(sectionChoice.programId);
    const requiredElectiveGroups = await ElectiveGroup.find({
      programId: sectionChoice.programId,
      semester: sectionChoice.semester,
      academicYearId: sectionChoice.academicYearId,
      isActive: true
    });

    const mandatoryGroups = requiredElectiveGroups.filter(group => group.rules.isMandatory);
    
    for (const mandatoryGroup of mandatoryGroups) {
      const hasChoice = sectionChoice.choices.find(choice => 
        choice.electiveGroupId.toString() === mandatoryGroup._id.toString()
      );
      
      if (!hasChoice) {
        return res.status(400).json({ 
          msg: `Missing selection for mandatory elective group: ${mandatoryGroup.name}` 
        });
      }
    }

    sectionChoice.status = 'Submitted';
    await sectionChoice.save();

    res.json(sectionChoice);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Approve or reject section elective choice
// @route   PUT /api/section-elective-choices/:id/approve
// @access  Private/Admin
exports.approveSectionElectiveChoice = async (req, res) => {
  try {
    const { approved, rejectionReason } = req.body;
    
    const sectionChoice = await SectionElectiveChoice.findById(req.params.id);
    
    if (!sectionChoice) {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }

    if (sectionChoice.status !== 'Submitted') {
      return res.status(400).json({ 
        msg: 'Only submitted choices can be approved or rejected' 
      });
    }

    if (approved) {
      sectionChoice.status = 'Approved';
      sectionChoice.approvedBy = req.user.id;
      sectionChoice.approvedAt = new Date();
      sectionChoice.rejectionReason = undefined;
    } else {
      if (!rejectionReason) {
        return res.status(400).json({ 
          msg: 'Rejection reason is required when rejecting' 
        });
      }
      sectionChoice.status = 'Rejected';
      sectionChoice.rejectionReason = rejectionReason;
      sectionChoice.approvedBy = undefined;
      sectionChoice.approvedAt = undefined;
    }

    await sectionChoice.save();
    res.json(sectionChoice);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Delete section elective choice
// @route   DELETE /api/section-elective-choices/:id
// @access  Private/Admin
exports.deleteSectionElectiveChoice = async (req, res) => {
  try {
    const sectionChoice = await SectionElectiveChoice.findById(req.params.id);
    
    if (!sectionChoice) {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }

    if (sectionChoice.status === 'Approved') {
      return res.status(400).json({ 
        msg: 'Cannot delete approved elective choices' 
      });
    }

    await SectionElectiveChoice.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Section elective choice deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Section elective choice not found' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// @desc    Get elective choices summary for a program/semester
// @route   GET /api/section-elective-choices/summary
// @access  Private
exports.getElectiveChoicesSummary = async (req, res) => {
  try {
    const { programId, academicYearId, semester } = req.query;
    
    if (!programId || !academicYearId || !semester) {
      return res.status(400).json({ 
        msg: 'Program ID, academic year ID, and semester are required' 
      });
    }

    const choices = await SectionElectiveChoice.find({
      programId,
      academicYearId,
      semester: parseInt(semester),
      status: 'Approved'
    }).populate('choices.selectedSubjectId', 'code name');

    // Create summary statistics
    const summary = {
      totalSections: choices.length,
      choicesBySubject: {},
      choicesByElectiveGroup: {}
    };

    choices.forEach(sectionChoice => {
      sectionChoice.choices.forEach(choice => {
        const subjectCode = choice.subjectCode;
        const subjectName = choice.subjectName;
        
        if (!summary.choicesBySubject[subjectCode]) {
          summary.choicesBySubject[subjectCode] = {
            subjectName,
            sectionCount: 0,
            sections: []
          };
        }
        
        summary.choicesBySubject[subjectCode].sectionCount++;
        summary.choicesBySubject[subjectCode].sections.push(sectionChoice.section);
      });
    });

    res.json(summary);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
