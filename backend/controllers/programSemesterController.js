const ProgramSemester = require('../models/ProgramSemester');
const Subject = require('../models/Subject');
const Program = require('../models/Program');
const { validationResult } = require('express-validator');

// @desc    Get subjects for a specific program and semester
// @route   GET /api/program-semesters/:programCode/:semester/subjects
// @access  Public
exports.getSubjectsForProgramSemester = async (req, res) => {
  try {
    const { programCode, semester } = req.params;

    // Get the program-semester document
    const programSemesterDoc = await ProgramSemester.findOne({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      status: 'Active'
    });

    if (!programSemesterDoc) {
      return res.json({
        success: true,
        data: [],
        message: `No curriculum found for ${programCode} Semester ${semester}`
      });
    }

    // If subject names/codes are denormalized, return directly
    const subjectsWithInfo = programSemesterDoc.subjectsOffered.map(subject => ({
      _id: subject.subjectId,
      subjectId: subject.subjectId,
      name: subject.subjectName_display,
      code: subject.subjectCode_display,
      courseType: subject.courseType,
      isElective: subject.isElective,
      defaultHoursTheory: subject.defaultHoursTheory,
      defaultHoursPractical: subject.defaultHoursPractical
    }));

    res.json({
      success: true,
      data: subjectsWithInfo,
      programCode: programSemesterDoc.programCode,
      semester: programSemesterDoc.semester,
      academicYear: programSemesterDoc.academicYear
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get full curriculum for a program
// @route   GET /api/program-semesters/:programCode
// @access  Public
exports.getProgramCurriculum = async (req, res) => {
  try {
    const { programCode } = req.params;

    const curriculum = await ProgramSemester.find({
      programCode: programCode.toUpperCase(),
      status: 'Active'
    }).sort({ semester: 1 });

    res.json({
      success: true,
      data: curriculum
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create or update program semester curriculum
// @route   POST /api/program-semesters
// @access  Private/Admin
exports.createProgramSemester = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { programCode, semester, subjectsOffered, academicYear } = req.body;

    // Validate program exists
    const program = await Program.findOne({ code: programCode.toUpperCase() });
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    // Validate all subjects exist and populate display fields
    const populatedSubjects = [];
    for (const subjectData of subjectsOffered) {
      const subject = await Subject.findById(subjectData.subjectId);
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: `Subject not found: ${subjectData.subjectId}`
        });
      }

      populatedSubjects.push({
        subjectId: subject._id,
        subjectCode_display: subject.code,
        subjectName_display: subject.name,
        courseType: subjectData.courseType || 'Core',
        isElective: subjectData.isElective || false,
        defaultHoursTheory: subjectData.defaultHoursTheory || 3,
        defaultHoursPractical: subjectData.defaultHoursPractical || 0
      });
    }

    // Check if already exists
    let programSemester = await ProgramSemester.findOne({
      programCode: programCode.toUpperCase(),
      semester,
      status: 'Active'
    });

    if (programSemester) {
      // Update existing
      programSemester.subjectsOffered = populatedSubjects;
      programSemester.academicYear = academicYear || programSemester.academicYear;
      await programSemester.save();
    } else {
      // Create new
      programSemester = new ProgramSemester({
        programCode: programCode.toUpperCase(),
        semester,
        subjectsOffered: populatedSubjects,
        academicYear: academicYear || '2024-2025'
      });
      await programSemester.save();
    }

    res.status(201).json({
      success: true,
      data: programSemester
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Add subject to program semester
// @route   POST /api/program-semesters/:programCode/:semester/subjects
// @access  Private/Admin
exports.addSubjectToProgramSemester = async (req, res) => {
  try {
    const { programCode, semester } = req.params;
    const { subjectId, courseType, isElective, defaultHoursTheory, defaultHoursPractical } = req.body;

    // Validate subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Find program semester
    let programSemester = await ProgramSemester.findOne({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      status: 'Active'
    });

    if (!programSemester) {
      return res.status(404).json({
        success: false,
        message: 'Program semester not found'
      });
    }

    // Check if subject already exists
    const existingSubject = programSemester.subjectsOffered.find(
      s => s.subjectId.toString() === subjectId
    );

    if (existingSubject) {
      return res.status(409).json({
        success: false,
        message: 'Subject already exists in this program semester'
      });
    }

    // Add subject
    programSemester.subjectsOffered.push({
      subjectId: subject._id,
      subjectCode_display: subject.code,
      subjectName_display: subject.name,
      courseType: courseType || 'Core',
      isElective: isElective || false,
      defaultHoursTheory: defaultHoursTheory || 3,
      defaultHoursPractical: defaultHoursPractical || 0
    });

    await programSemester.save();

    res.json({
      success: true,
      data: programSemester
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Remove subject from program semester
// @route   DELETE /api/program-semesters/:programCode/:semester/subjects/:subjectId
// @access  Private/Admin
exports.removeSubjectFromProgramSemester = async (req, res) => {
  try {
    const { programCode, semester, subjectId } = req.params;

    const programSemester = await ProgramSemester.findOne({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      status: 'Active'
    });

    if (!programSemester) {
      return res.status(404).json({
        success: false,
        message: 'Program semester not found'
      });
    }

    // Remove subject
    programSemester.subjectsOffered = programSemester.subjectsOffered.filter(
      s => s.subjectId.toString() !== subjectId
    );

    await programSemester.save();

    res.json({
      success: true,
      data: programSemester
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
