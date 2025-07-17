const Subject = require('../models/Subject');
const { validationResult } = require('express-validator');

// @desc    Create a new subject
// @route   POST /api/subjects
// @access  Private/Admin
exports.createSubject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const subject = new Subject(req.body);
    await subject.save();
    res.status(201).json(subject);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'Subject with this code already exists' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Create multiple subjects at once (bulk creation)
// @route   POST /api/subjects/bulk
// @access  Private/Admin
exports.createSubjectsBulk = async (req, res) => {
  try {
    // Handle both formats: direct array or wrapped in "subjects" property
    let subjectsArray;
    
    if (Array.isArray(req.body)) {
      // Direct array format: [subject1, subject2, ...]
      subjectsArray = req.body;
    } else if (req.body.subjects && Array.isArray(req.body.subjects)) {
      // Wrapped format: {"subjects": [subject1, subject2, ...]}
      subjectsArray = req.body.subjects;
    } else {
      return res.status(400).json({ 
        success: false,
        msg: 'Request body must be an array of subjects or an object with "subjects" array property' 
      });
    }

    // Validate minimum requirements
    if (subjectsArray.length === 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'At least one subject is required' 
      });
    }

    // Validate each subject has required fields
    const errors = [];
    subjectsArray.forEach((subject, index) => {
      if (!subject.name) errors.push(`Subject ${index + 1}: name is required`);
      if (!subject.code) errors.push(`Subject ${index + 1}: code is required`);
      if (!subject.programId || !Array.isArray(subject.programId)) {
        errors.push(`Subject ${index + 1}: programId must be an array`);
      }
      if (!subject.semester) errors.push(`Subject ${index + 1}: semester is required`);
      if (!subject.credits) errors.push(`Subject ${index + 1}: credits object is required`);
      if (!subject.weeklyHours) errors.push(`Subject ${index + 1}: weeklyHours object is required`);
    });

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'Validation errors',
        errors: errors 
      });
    }

    // Use insertMany for bulk creation with ordered: false to continue on duplicates
    const result = await Subject.insertMany(subjectsArray, { 
      ordered: false 
    });

    res.status(201).json({
      success: true,
      message: `Successfully created ${result.length} subjects`,
      insertedCount: result.length,
      subjects: result
    });

  } catch (err) {
    console.error('Bulk subject creation error:', err);
    
    // Handle duplicate key errors (code 11000)
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: 'One or more subjects with duplicate codes already exist',
        error: err.message
      });
    }

    // Handle bulk write errors
    if (err.writeErrors) {
      const duplicates = err.writeErrors.map(error => ({
        index: error.index,
        code: error.err.keyValue?.code,
        message: 'Subject with this code already exists'
      }));
      
      const successCount = subjectsArray.length - err.writeErrors.length;
      
      return res.status(207).json({ // 207 Multi-Status
        success: true,
        message: `Partially successful: ${successCount} subjects created, ${duplicates.length} duplicates skipped`,
        insertedCount: successCount,
        duplicates: duplicates,
        skippedCount: duplicates.length
      });
    }

    res.status(500).json({
      success: false,
      msg: 'Server error during bulk creation',
      error: err.message
    });
  }
};

// @desc    Get all subjects
// @route   GET /api/subjects
// @access  Private
exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get subjects by program ID
// @route   GET /api/subjects/program/:programId
// @access  Private
exports.getSubjectsByProgramId = async (req, res) => {
  try {
    // Find subjects where programId array contains the requested program ID
    const subjects = await Subject.find({ 
      programId: { $in: [req.params.programId] } 
    }).populate('programId', 'name code');
    res.json(subjects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get subjects by semester
// @route   GET /api/subjects/semester/:semester
// @access  Private
exports.getSubjectsBySemester = async (req, res) => {
  try {
    const subjects = await Subject.find({ semester: req.params.semester }).populate('programId', 'name code');
    res.json(subjects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get subject by ID
// @route   GET /api/subjects/:id
// @access  Private
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('programId', 'name code');
    
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    res.json(subject);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Subject not found' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
exports.updateSubject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let subject = await Subject.findById(req.params.id);
    
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.json(subject);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Subject not found' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    await Subject.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Subject removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Subject not found' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Bulk delete subjects by IDs
// @route   DELETE /api/subjects/bulk
// @access  Private/Admin
exports.deleteSubjectsBulk = async (req, res) => {
  try {
    // Handle both formats: direct array or wrapped in "subjectIds" property
    let subjectIds;
    
    if (Array.isArray(req.body)) {
      // Direct array format: [id1, id2, ...]
      subjectIds = req.body;
    } else if (req.body.subjectIds && Array.isArray(req.body.subjectIds)) {
      // Wrapped format: {"subjectIds": [id1, id2, ...]}
      subjectIds = req.body.subjectIds;
    } else {
      return res.status(400).json({ 
        success: false,
        msg: 'Request body must be an array of subject IDs or an object with "subjectIds" array property' 
      });
    }

    // Validate minimum requirements
    if (subjectIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'At least one subject ID is required' 
      });
    }

    // Validate each ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    const invalidIds = [];
    subjectIds.forEach((id, index) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        invalidIds.push(`Index ${index}: "${id}" is not a valid MongoDB ObjectId`);
      }
    });

    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid subject IDs',
        errors: invalidIds 
      });
    }

    // Check which subjects exist before deletion
    const existingSubjects = await Subject.find({ _id: { $in: subjectIds } });
    const existingIds = existingSubjects.map(subject => subject._id.toString());
    const notFoundIds = subjectIds.filter(id => !existingIds.includes(id));

    if (existingSubjects.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'No subjects found with the provided IDs',
        notFoundIds: notFoundIds
      });
    }

    // Perform bulk deletion
    const deleteResult = await Subject.deleteMany({ _id: { $in: existingIds } });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} subjects`,
      deletedCount: deleteResult.deletedCount,
      deletedSubjects: existingSubjects.map(s => ({ id: s._id, name: s.name, code: s.code })),
      notFoundIds: notFoundIds,
      notFoundCount: notFoundIds.length
    });

  } catch (err) {
    console.error('Bulk subject deletion error:', err);
    res.status(500).json({
      success: false,
      msg: 'Server error during bulk deletion',
      error: err.message
    });
  }
};

// @desc    Delete subjects by program ID
// @route   DELETE /api/subjects/program/:programId
// @access  Private/Admin
exports.deleteSubjectsByProgramId = async (req, res) => {
  try {
    const { programId } = req.params;
    
    // Validate programId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid program ID format' 
      });
    }

    // Find subjects that belong to this program
    const subjectsToDelete = await Subject.find({ 
      programId: { $in: [programId] } 
    });

    if (subjectsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        msg: 'No subjects found for the specified program ID',
        programId: programId
      });
    }

    // Check if subjects belong to multiple programs
    const subjectsWithMultiplePrograms = subjectsToDelete.filter(
      subject => subject.programId.length > 1
    );

    const subjectsExclusiveToProgram = subjectsToDelete.filter(
      subject => subject.programId.length === 1
    );

    let deletedCount = 0;
    let updatedCount = 0;
    const deletedSubjects = [];
    const updatedSubjects = [];

    // For subjects exclusive to this program, delete them completely
    if (subjectsExclusiveToProgram.length > 0) {
      const exclusiveIds = subjectsExclusiveToProgram.map(s => s._id);
      const deleteResult = await Subject.deleteMany({ _id: { $in: exclusiveIds } });
      deletedCount = deleteResult.deletedCount;
      deletedSubjects.push(...subjectsExclusiveToProgram.map(s => ({ 
        id: s._id, 
        name: s.name, 
        code: s.code,
        action: 'deleted'
      })));
    }

    // For subjects belonging to multiple programs, just remove this program ID
    for (const subject of subjectsWithMultiplePrograms) {
      const updatedProgramIds = subject.programId.filter(id => id.toString() !== programId);
      await Subject.findByIdAndUpdate(subject._id, { 
        programId: updatedProgramIds 
      });
      updatedCount++;
      updatedSubjects.push({
        id: subject._id,
        name: subject.name,
        code: subject.code,
        action: 'updated',
        remainingPrograms: updatedProgramIds.length
      });
    }

    res.status(200).json({
      success: true,
      message: `Program cleanup completed: ${deletedCount} subjects deleted, ${updatedCount} subjects updated`,
      programId: programId,
      deletedCount: deletedCount,
      updatedCount: updatedCount,
      totalProcessed: deletedCount + updatedCount,
      deletedSubjects: deletedSubjects,
      updatedSubjects: updatedSubjects
    });

  } catch (err) {
    console.error('Delete subjects by program ID error:', err);
    res.status(500).json({
      success: false,
      msg: 'Server error during program-based deletion',
      error: err.message
    });
  }
};

// @desc    Get shared subjects (subjects belonging to multiple programs)
// @route   GET /api/subjects/shared
// @access  Private
exports.getSharedSubjects = async (req, res) => {
  try {
    const sharedSubjects = await Subject.findSharedSubjects()
      .populate('programId', 'name code')
      .populate('departmentId', 'name code');
    
    res.json(sharedSubjects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get subjects by multiple program IDs
// @route   POST /api/subjects/by-programs
// @access  Private
exports.getSubjectsByPrograms = async (req, res) => {
  try {
    const { programIds } = req.body;
    
    if (!programIds || !Array.isArray(programIds)) {
      return res.status(400).json({ msg: 'programIds array is required' });
    }

    const subjects = await Subject.findByPrograms(programIds)
      .populate('programId', 'name code')
      .populate('departmentId', 'name code');
    
    res.json(subjects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
