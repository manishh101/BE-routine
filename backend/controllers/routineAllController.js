// @desc    Get all routines (paginated with filters)
// @route   GET /api/routines
// @access  Private
exports.getAllRoutines = async (req, res) => {
  try {
    const {
      programId,
      semester,
      section,
      academicYearId,
      dayIndex,
      isActive,
      page = 1,
      limit = 50,
      sortBy = 'dayIndex',
      sortOrder = 'asc'
    } = req.query;
    
    // Build filter object
    const filter = {};
    if (programId) filter.programId = programId;
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (academicYearId) filter.academicYearId = academicYearId;
    if (dayIndex !== undefined) filter.dayIndex = parseInt(dayIndex);
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Set up pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitVal = parseInt(limit);
    
    // Get total count for pagination
    const total = await RoutineSlot.countDocuments(filter);
    
    // Get paginated results with populated references
    const routines = await RoutineSlot.find(filter)
      .populate('programId', 'code name')
      .populate('subjectId', 'code name credits weeklyHours')
      .populate('teacherIds', 'shortName fullName')
      .populate('roomId', 'name building capacity')
      .populate('academicYearId', 'title nepaliYear status')
      .sort(sort)
      .skip(skip)
      .limit(limitVal);
    
    res.json({
      success: true,
      count: routines.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limitVal),
      data: routines
    });
  } catch (err) {
    console.error('Error in getAllRoutines:', err.message);
    res.status(500).json({
      success: false,
      msg: 'Server error',
      error: err.message
    });
  }
};
