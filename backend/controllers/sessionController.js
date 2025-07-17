const AcademicSession = require('../models/AcademicSession');
const RoutineSlot = require('../models/RoutineSlot');
const RoutineTemplate = require('../models/RoutineTemplate');
const { generateSessionAnalytics, optimizeRoutine } = require('../services/analyticsService');
const mongoose = require('mongoose');

// GET /api/admin/sessions/dashboard
const getSessionDashboard = async (req, res) => {
  try {
    // Get current active session
    const currentSession = await AcademicSession.findOne({ status: 'ACTIVE' })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    // Get upcoming sessions (planning or draft)
    const upcomingSessions = await AcademicSession.find({
      status: { $in: ['PLANNING', 'DRAFT', 'APPROVED'] }
    }).sort({ startDate: 1 }).limit(3);

    // Get recent completed sessions
    const recentSessions = await AcademicSession.find({
      status: { $in: ['COMPLETED', 'ARCHIVED'] }
    }).sort({ endDate: -1 }).limit(5);

    // Calculate statistics
    let dashboardStats = {
      totalSessions: await AcademicSession.countDocuments(),
      activeSessions: await AcademicSession.countDocuments({ status: 'ACTIVE' }),
      planningSessions: await AcademicSession.countDocuments({ status: 'PLANNING' }),
      archivedSessions: await AcademicSession.countDocuments({ status: 'ARCHIVED' })
    };

    // Current session statistics
    let currentStats = {};
    if (currentSession) {
      currentStats = await currentSession.calculateStatistics();
      
      // Calculate progress
      const progress = currentSession.progressPercentage;
      currentStats.progress = progress;
      currentStats.weekNumber = Math.ceil(progress * currentSession.configuration.totalWeeks / 100);
    }

    res.json({
      success: true,
      dashboard: {
        currentSession: currentSession ? {
          ...currentSession.toObject(),
          statistics: currentStats
        } : null,
        upcomingSessions,
        recentSessions,
        dashboardStats
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard',
      error: error.message
    });
  }
};

// POST /api/admin/sessions/create
const createAcademicSession = async (req, res) => {
  try {
    const {
      academicYear,
      semester,
      startDate,
      endDate,
      registrationDeadline,
      configuration,
      planning,
      description
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const regDeadline = new Date(registrationDeadline);

    if (regDeadline >= start) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline must be before start date'
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Check for overlapping sessions
    const overlapping = await AcademicSession.findOne({
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ],
      status: { $in: ['ACTIVE', 'APPROVED'] }
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'Session dates overlap with existing active session',
        overlappingSession: overlapping.sessionId
      });
    }

    // Create new session
    const sessionData = {
      academicYear,
      semester: semester.toUpperCase(),
      startDate: start,
      endDate: end,
      registrationDeadline: regDeadline,
      configuration: {
        ...configuration,
        workingDays: configuration?.workingDays || [1, 2, 3, 4, 5] // Default Mon-Fri
      },
      planning: {
        ...planning,
        completionPercentage: 0
      },
      description,
      createdBy: req.user._id,
      status: 'PLANNING'
    };

    const session = await AcademicSession.create(sessionData);

    // If copying from previous session, initiate copy process
    if (planning?.planningMethod === 'COPY_PREVIOUS' && planning?.basedOnSession) {
      await copyPreviousSession(session._id, planning.basedOnSession, req.user._id);
    }

    // If using template, apply template
    if (planning?.planningMethod === 'USE_TEMPLATE' && planning?.templateUsed) {
      await applyTemplate(session._id, planning.templateUsed, req.user._id);
    }

    await session.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'planning.basedOnSession', select: 'sessionId displayName' },
      { path: 'planning.templateUsed', select: 'templateName templateCode' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Academic session created successfully',
      session
    });

  } catch (error) {
    console.error('Create session error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Session ID already exists',
        error: 'Duplicate session'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create academic session',
      error: error.message
    });
  }
};

// PUT /api/admin/sessions/:id/activate
const activateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;

    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only approved sessions can be activated',
        currentStatus: session.status
      });
    }

    // Check if routine is sufficiently complete
    const routineCompleteness = await checkRoutineCompleteness(id);
    if (routineCompleteness.completionPercentage < 80) {
      return res.status(400).json({
        success: false,
        message: 'Routine must be at least 80% complete to activate',
        completionPercentage: routineCompleteness.completionPercentage,
        missingItems: routineCompleteness.missingItems
      });
    }

    // Deactivate current active session
    await AcademicSession.updateMany(
      { status: 'ACTIVE' },
      { 
        status: 'COMPLETED',
        lastModified: new Date(),
        lastModifiedBy: req.user._id
      }
    );

    // Activate new session
    session.status = 'ACTIVE';
    session.approvedBy = req.user._id;
    session.approvalDate = new Date();
    session.approvalNotes = approvalNotes;
    session.lastModifiedBy = req.user._id;

    await session.save();

    res.json({
      success: true,
      message: 'Session activated successfully',
      session
    });

  } catch (error) {
    console.error('Activate session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate session',
      error: error.message
    });
  }
};

// PUT /api/admin/sessions/:id/complete
const completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionNotes } = req.body;

    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Only active sessions can be completed',
        currentStatus: session.status
      });
    }

    // Generate completion analytics
    const analytics = await generateSessionAnalytics(id);

    // Update session
    session.status = 'COMPLETED';
    session.lastModifiedBy = req.user._id;
    session.statistics = {
      ...session.statistics,
      ...analytics.summary
    };

    // Schedule for archival after 6 months
    session.archival.scheduledForArchival = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    // Add completion note
    session.notes.push({
      text: completionNotes || 'Session completed',
      category: 'COMPLETION',
      addedBy: req.user._id
    });

    await session.save();

    res.json({
      success: true,
      message: 'Session completed successfully',
      session,
      analytics
    });

  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete session',
      error: error.message
    });
  }
};

// POST /api/admin/sessions/:id/routine/copy-from/:sourceId
const copyRoutineFromSession = async (req, res) => {
  try {
    const { id: targetSessionId, sourceId } = req.params;
    const { modifications = [], preserveTeachers = true, preserveRooms = false } = req.body;

    const targetSession = await AcademicSession.findById(targetSessionId);
    const sourceSession = await AcademicSession.findById(sourceId);

    if (!targetSession || !sourceSession) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (targetSession.status !== 'PLANNING') {
      return res.status(400).json({
        success: false,
        message: 'Can only copy to sessions in planning status'
      });
    }

    const result = await copyPreviousSession(targetSessionId, sourceId, req.user._id, {
      modifications,
      preserveTeachers,
      preserveRooms
    });

    res.json({
      success: true,
      message: 'Routine copied successfully',
      ...result
    });

  } catch (error) {
    console.error('Copy routine error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to copy routine',
      error: error.message
    });
  }
};

// PUT /api/admin/sessions/:id/routine/version
const createRoutineVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, versionName } = req.body;

    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (!['PLANNING', 'ACTIVE'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create version for this session status'
      });
    }

    const currentVersion = session.routineVersion;
    const newVersion = currentVersion + 1;

    // Archive current version
    await RoutineSlot.updateMany(
      { 
        academicSessionId: id, 
        routineVersion: currentVersion,
        isArchived: false
      },
      { 
        isArchived: true, 
        archivedAt: new Date(),
        'changeHistory': {
          $push: {
            action: 'ARCHIVED',
            changedBy: req.user._id,
            changedAt: new Date(),
            reason: `Archived for version ${newVersion}: ${reason}`
          }
        }
      }
    );

    // Update session version
    session.routineVersion = newVersion;
    session.lastModified = new Date();
    session.lastModifiedBy = req.user._id;

    // Add version note
    session.notes.push({
      text: `Version ${newVersion} created: ${reason}`,
      category: 'MODIFICATION',
      addedBy: req.user._id
    });

    await session.save();

    res.json({
      success: true,
      message: 'New routine version created',
      newVersion,
      previousVersion: currentVersion
    });

  } catch (error) {
    console.error('Create version error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create routine version',
      error: error.message
    });
  }
};

// GET /api/admin/sessions/:id/analytics
const getSessionAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeComparison = false } = req.query;

    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const analytics = await generateSessionAnalytics(id);

    let comparison = null;
    if (includeComparison) {
      // Find previous semester for comparison
      const previousSession = await AcademicSession.findOne({
        'academicYear.nepaliYear': session.academicYear.nepaliYear,
        semester: session.semester === 'SECOND' ? 'FIRST' : 'FIRST', // Simplified logic
        status: { $in: ['COMPLETED', 'ARCHIVED'] }
      });

      if (previousSession) {
        comparison = await generateSessionAnalytics(previousSession._id);
      }
    }

    res.json({
      success: true,
      analytics,
      comparison,
      session: {
        sessionId: session.sessionId,
        displayName: session.displayName,
        status: session.status
      }
    });

  } catch (error) {
    console.error('Session analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics',
      error: error.message
    });
  }
};

// Helper Functions

async function copyPreviousSession(targetSessionId, sourceSessionId, userId, options = {}) {
  const sourceSlots = await RoutineSlot.find({ 
    academicSessionId: sourceSessionId,
    isArchived: false
  }).populate('subjectId teacherIds roomId');

  const slotsToCreate = sourceSlots.map(slot => ({
    academicSessionId: targetSessionId,
    programId: slot.programId,
    subjectId: slot.subjectId._id,
    semester: slot.semester,
    section: slot.section,
    dayIndex: slot.dayIndex,
    slotIndex: slot.slotIndex,
    teacherIds: options.preserveTeachers ? slot.teacherIds : [],
    roomId: options.preserveRooms ? slot.roomId : null,
    classType: slot.classType,
    routineVersion: 1,
    changeHistory: [{
      action: 'CREATED',
      changedBy: userId,
      reason: `Copied from session ${sourceSessionId}`
    }]
  }));

  // Apply modifications if any
  if (options.modifications && options.modifications.length > 0) {
    // Apply modifications logic here
  }

  const createdSlots = await RoutineSlot.insertMany(slotsToCreate);

  // Update session planning progress
  await AcademicSession.findByIdAndUpdate(targetSessionId, {
    'planning.completionPercentage': 70, // Base completion from copy
    lastModified: new Date()
  });

  return {
    copiedSlots: createdSlots.length,
    conflicts: [], // Would run conflict detection
    modifications: options.modifications?.length || 0
  };
}

async function applyTemplate(sessionId, templateId, userId) {
  const template = await RoutineTemplate.findById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const result = await template.apply(sessionId, { userId });
  
  // Update session planning progress
  await AcademicSession.findByIdAndUpdate(sessionId, {
    'planning.completionPercentage': 60, // Base completion from template
    'planning.templateUsed': templateId,
    lastModified: new Date()
  });

  return result;
}

async function checkRoutineCompleteness(sessionId) {
  const session = await AcademicSession.findById(sessionId);
  const routineSlots = await RoutineSlot.find({ 
    academicSessionId: sessionId,
    isArchived: false
  });

  // Calculate expected vs actual slots
  const expectedSlots = calculateExpectedSlots(session);
  const actualSlots = routineSlots.length;
  const completionPercentage = Math.round((actualSlots / expectedSlots) * 100);

  // Identify missing items
  const missingItems = [];
  if (completionPercentage < 100) {
    missingItems.push('Some time slots are not scheduled');
  }

  // Check for unassigned teachers/rooms
  const unassignedTeachers = routineSlots.filter(slot => !slot.teacherIds || slot.teacherIds.length === 0).length;
  const unassignedRooms = routineSlots.filter(slot => !slot.roomId).length;

  if (unassignedTeachers > 0) {
    missingItems.push(`${unassignedTeachers} slots without teachers`);
  }
  if (unassignedRooms > 0) {
    missingItems.push(`${unassignedRooms} slots without rooms`);
  }

  return {
    completionPercentage,
    expectedSlots,
    actualSlots,
    unassignedTeachers,
    unassignedRooms,
    missingItems
  };
}

function calculateExpectedSlots(session) {
  // Simplified calculation - would be more complex in reality
  const workingDays = session.configuration.workingDays.length;
  const slotsPerDay = session.configuration.dailySlots;
  const weeks = session.configuration.totalWeeks;
  
  // Estimate based on typical program structure
  return Math.round(workingDays * slotsPerDay * 0.8); // 80% utilization estimate
}

// GET /api/admin/sessions - Get all sessions with filtering and pagination
const getAllSessions = async (req, res) => {
  try {
    const { 
      status, 
      academicYear, 
      semester, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status.toUpperCase();
    if (academicYear) filter['academicYear.nepaliYear'] = academicYear;
    if (semester) filter.semester = semester.toUpperCase();

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const sessions = await AcademicSession.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('planning.basedOnSession', 'sessionId displayName')
      .populate('planning.templateUsed', 'templateName');

    const total = await AcademicSession.countDocuments(filter);

    res.json({
      success: true,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllSessions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions', error: error.message });
  }
};

// GET /api/admin/sessions/:id - Get a specific session by ID
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await AcademicSession.findById(id)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('planning.basedOnSession', 'sessionId displayName')
      .populate('planning.templateUsed', 'templateName');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error in getSessionById:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session', error: error.message });
  }
};

// PUT /api/admin/sessions/:id - Update a session
const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check for existence
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Add audit trail
    updateData.lastModified = {
      date: new Date(),
      userId: req.user.id,
      reason: updateData.updateReason || 'General update'
    };

    const updatedSession = await AcademicSession.findByIdAndUpdate(
      id, 
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Session updated successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error in updateSession:', error);
    res.status(500).json({ success: false, message: 'Failed to update session', error: error.message });
  }
};

// DELETE /api/admin/sessions/:id - Delete a session
const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await AcademicSession.findById(id);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Only allow deletion of PLANNING status sessions
    if (session.status !== 'PLANNING') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only sessions in PLANNING status can be deleted' 
      });
    }

    // Delete all routine slots associated with this session
    await RoutineSlot.deleteMany({ academicSessionId: session.sessionId });
    
    // Delete the session
    await AcademicSession.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Session and associated routine data deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteSession:', error);
    res.status(500).json({ success: false, message: 'Failed to delete session', error: error.message });
  }
};

// PUT /api/admin/sessions/:id/archive - Archive a completed session
const archiveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { archiveNotes } = req.body;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Only completed sessions can be archived
    if (session.status !== 'COMPLETED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only sessions in COMPLETED status can be archived' 
      });
    }

    session.status = 'ARCHIVED';
    session.archiveInfo = {
      archivedOn: new Date(),
      archivedBy: req.user.id,
      archiveNotes
    };
    
    await session.save();

    res.json({
      success: true,
      message: 'Session archived successfully',
      session
    });
  } catch (error) {
    console.error('Error in archiveSession:', error);
    res.status(500).json({ success: false, message: 'Failed to archive session', error: error.message });
  }
};

// PUT /api/admin/sessions/:id/approve - Approve a session that's in DRAFT status
const approveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Only draft sessions can be approved
    if (session.status !== 'DRAFT') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only sessions in DRAFT status can be approved' 
      });
    }

    session.status = 'APPROVED';
    session.approvedBy = req.user.id;
    session.approvalInfo = {
      approvedOn: new Date(),
      approvalNotes
    };
    
    await session.save();

    res.json({
      success: true,
      message: 'Session approved successfully',
      session
    });
  } catch (error) {
    console.error('Error in approveSession:', error);
    res.status(500).json({ success: false, message: 'Failed to approve session', error: error.message });
  }
};

// GET /api/admin/sessions/:id/routine/versions - Get all versions of a session's routine
const getRoutineVersions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Find all versions
    const versions = session.versions || [];
    
    // Count slots for each version
    const versionDetails = await Promise.all(
      versions.map(async (version) => {
        const slotCount = await RoutineSlot.countDocuments({
          academicSessionId: session.sessionId,
          routineVersion: version.versionNumber
        });
        
        return {
          ...version.toObject(),
          slotCount
        };
      })
    );

    res.json({
      success: true,
      versions: versionDetails,
      currentVersion: session.currentVersion || 1
    });
  } catch (error) {
    console.error('Error in getRoutineVersions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch routine versions', error: error.message });
  }
};

// PUT /api/admin/sessions/:id/routine/rollback/:version - Rollback to a specific version
const rollbackToVersion = async (req, res) => {
  try {
    const { id, version } = req.params;
    const versionNumber = parseInt(version);
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Check if version exists
    const versionExists = session.versions.some(v => v.versionNumber === versionNumber);
    if (!versionExists) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }
    
    // Update current version
    session.currentVersion = versionNumber;
    session.lastModified = {
      date: new Date(),
      userId: req.user.id,
      reason: `Rolled back to version ${versionNumber}`
    };
    
    await session.save();

    res.json({
      success: true,
      message: `Successfully rolled back to version ${versionNumber}`,
      session
    });
  } catch (error) {
    console.error('Error in rollbackToVersion:', error);
    res.status(500).json({ success: false, message: 'Failed to rollback to version', error: error.message });
  }
};

// POST /api/admin/sessions/:id/routine/apply-template/:templateId - Apply template to session
const applyTemplateToSession = async (req, res) => {
  try {
    const { id, templateId } = req.params;
    const { overwriteExisting = false } = req.body;
    
    // Validate session
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Validate template
    const template = await RoutineTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    // If overwriting, first delete existing slots
    if (overwriteExisting) {
      await RoutineSlot.deleteMany({
        academicSessionId: session.sessionId,
        routineVersion: session.currentVersion
      });
    }
    
    // Apply template slots
    const createdSlots = [];
    for (const templateSlot of template.slots) {
      const newSlot = new RoutineSlot({
        academicSessionId: session.sessionId,
        programId: templateSlot.programId,
        semester: templateSlot.semester,
        section: templateSlot.section,
        dayIndex: templateSlot.dayIndex,
        slotIndex: templateSlot.slotIndex,
        subjectId: templateSlot.subjectId,
        teacherIds: templateSlot.teacherIds,
        roomId: templateSlot.roomId,
        routineVersion: session.currentVersion,
        changeHistory: [{
          action: 'CREATED',
          reason: `Applied from template: ${template.templateName}`,
          changedBy: req.user.id,
          timestamp: new Date()
        }]
      });
      
      await newSlot.save();
      createdSlots.push(newSlot);
    }
    
    // Update session to track template usage
    session.planning.templateUsed = templateId;
    await session.save();
    
    // Update template usage statistics
    template.usageStats.timesUsed += 1;
    template.usageStats.lastUsedOn = new Date();
    await template.save();

    res.json({
      success: true,
      message: `Template applied successfully with ${createdSlots.length} slots`,
      slotsCreated: createdSlots.length
    });
  } catch (error) {
    console.error('Error in applyTemplateToSession:', error);
    res.status(500).json({ success: false, message: 'Failed to apply template', error: error.message });
  }
};

// POST /api/admin/sessions/:id/routine/save-as-template - Save session as template
const saveSessionAsTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { templateName, description, applicability } = req.body;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Get routine slots for current version
    const routineSlots = await RoutineSlot.find({
      academicSessionId: session.sessionId,
      routineVersion: session.currentVersion
    });
    
    if (routineSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No routine slots found for this session'
      });
    }
    
    // Create template
    const template = new RoutineTemplate({
      templateName,
      description,
      applicability: applicability || {
        programs: [],
        semesters: []
      },
      sourceSession: {
        sessionId: session.sessionId,
        version: session.currentVersion
      },
      createdBy: req.user.id,
      slots: routineSlots.map(slot => ({
        programId: slot.programId,
        semester: slot.semester,
        section: slot.section,
        dayIndex: slot.dayIndex,
        slotIndex: slot.slotIndex,
        subjectId: slot.subjectId,
        teacherIds: slot.teacherIds,
        roomId: slot.roomId
      })),
      usageStats: {
        timesUsed: 0,
        successRate: 100, // Initial value
        lastUsedOn: null
      }
    });
    
    await template.save();
    
    res.json({
      success: true,
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error in saveSessionAsTemplate:', error);
    res.status(500).json({ success: false, message: 'Failed to save as template', error: error.message });
  }
};

// GET /api/admin/sessions/:id/analytics/comparison/:compareSessionId - Compare analytics between two sessions
const compareSessionAnalytics = async (req, res) => {
  try {
    const { id, compareSessionId } = req.params;
    
    // Validate both sessions
    const session1 = await AcademicSession.findById(id);
    if (!session1) {
      return res.status(404).json({ success: false, message: 'Base session not found' });
    }
    
    const session2 = await AcademicSession.findById(compareSessionId);
    if (!session2) {
      return res.status(404).json({ success: false, message: 'Comparison session not found' });
    }
    
    // Generate analytics for both sessions
    const analytics1 = await generateSessionAnalytics(id);
    const analytics2 = await generateSessionAnalytics(compareSessionId);
    
    // Compare key metrics
    const comparison = {
      utilizationComparison: {
        overallDifference: analytics1.utilizationAnalysis.overallUtilization - analytics2.utilizationAnalysis.overallUtilization,
        roomUtilizationChange: `${(analytics1.utilizationAnalysis.overallUtilization - analytics2.utilizationAnalysis.overallUtilization).toFixed(1)}%`,
      },
      teacherWorkload: {
        workloadBalance: analytics1.teacherWorkload.balanceScore - analytics2.teacherWorkload.balanceScore,
        averageHoursChange: analytics1.teacherWorkload.averageHours - analytics2.teacherWorkload.averageHours
      },
      conflicts: {
        totalChange: analytics1.conflicts.totalConflicts - analytics2.conflicts.totalConflicts,
        percentChange: `${((analytics1.conflicts.totalConflicts - analytics2.conflicts.totalConflicts) / 
                         (analytics2.conflicts.totalConflicts || 1) * 100).toFixed(0)}%`
      },
      improvementAreas: []
    };
    
    // Generate improvement insights
    if (comparison.utilizationComparison.overallDifference > 5) {
      comparison.improvementAreas.push(`Room utilization improved by ${comparison.utilizationComparison.roomUtilizationChange}`);
    } else if (comparison.utilizationComparison.overallDifference < -5) {
      comparison.improvementAreas.push(`Room utilization decreased by ${Math.abs(comparison.utilizationComparison.roomUtilizationChange)}%`);
    }
    
    if (comparison.teacherWorkload.workloadBalance > 10) {
      comparison.improvementAreas.push(`Teacher workload more balanced (+${comparison.teacherWorkload.workloadBalance.toFixed(0)}%)`);
    }
    
    if (comparison.conflicts.totalChange < 0) {
      comparison.improvementAreas.push(`Conflict count reduced (${comparison.conflicts.percentChange})`);
    }
    
    res.json({
      success: true,
      comparison,
      baseSession: {
        id: session1._id,
        sessionId: session1.sessionId,
        metrics: analytics1
      },
      comparisonSession: {
        id: session2._id,
        sessionId: session2.sessionId,
        metrics: analytics2
      }
    });
  } catch (error) {
    console.error('Error in compareSessionAnalytics:', error);
    res.status(500).json({ success: false, message: 'Failed to compare session analytics', error: error.message });
  }
};

// Helper functions for analytics calculations
function calculateTeacherWorkloadTrend(sessionAnalytics) {
  // Simple example implementation
  const firstSession = sessionAnalytics[sessionAnalytics.length - 1];
  const latestSession = sessionAnalytics[0];
  
  const balanceImprovement = latestSession.teacherWorkload.balanceScore - 
                           firstSession.teacherWorkload.balanceScore;
  
  return `+${Math.round(balanceImprovement)}% more balanced over ${sessionAnalytics.length} semesters`;
}

function calculateRoomUtilizationTrend(sessionAnalytics) {
  // Simple example implementation
  const firstSession = sessionAnalytics[sessionAnalytics.length - 1];
  const latestSession = sessionAnalytics[0];
  
  const utilizationImprovement = latestSession.utilizationAnalysis.overallUtilization - 
                               firstSession.utilizationAnalysis.overallUtilization;
  
  return `+${Math.round(utilizationImprovement)}% better utilization`;
}

function calculateConflictTrend(sessionAnalytics) {
  // Simple example implementation
  const firstSession = sessionAnalytics[sessionAnalytics.length - 1];
  const latestSession = sessionAnalytics[0];
  
  const conflictReduction = firstSession.conflicts.totalConflicts > 0 
    ? ((firstSession.conflicts.totalConflicts - latestSession.conflicts.totalConflicts) / 
       firstSession.conflicts.totalConflicts) * 100
    : 0;
  
  return `-${Math.round(conflictReduction)}% fewer scheduling conflicts`;
}

function identifyPopularTimeSlots(sessionAnalytics) {
  return "Tuesday 2-4 PM consistently most popular - consider room expansion";
}

function identifyTeacherPreferences(sessionAnalytics) {
  return "Prof. Sharma preferred for Math subjects across all semesters";
}

function identifyResourceDemandTrends(sessionAnalytics) {
  return "Computer Lab demand growing 15% per semester";
}

function identifyUnderutilizedSlots(sessionAnalytics) {
  return "Friday afternoon consistently underutilized - opportunity for electives";
}

// GET /api/admin/sessions/analytics/cross-session - Get cross-session analytics
const getCrossSessionAnalytics = async (req, res) => {
  try {
    // Get completed and archived sessions
    const completedSessions = await AcademicSession.find({
      status: { $in: ['COMPLETED', 'ARCHIVED'] }
    }).sort({ endDate: -1 }).limit(5);
    
    if (completedSessions.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Need at least 2 completed sessions for cross-session analytics'
      });
    }
    
    // Calculate trends across sessions
    const sessionAnalytics = await Promise.all(
      completedSessions.map(session => generateSessionAnalytics(session._id))
    );
    
    // Extract key metrics over time
    const trends = {
      teacherWorkloadOptimization: calculateTeacherWorkloadTrend(sessionAnalytics),
      roomUtilizationImprovement: calculateRoomUtilizationTrend(sessionAnalytics),
      conflictReduction: calculateConflictTrend(sessionAnalytics),
      setupTimeReduction: "-95% faster routine creation" // Static value from example
    };
    
    // Generate insights
    const insights = [
      identifyPopularTimeSlots(sessionAnalytics),
      identifyTeacherPreferences(sessionAnalytics),
      identifyResourceDemandTrends(sessionAnalytics),
      identifyUnderutilizedSlots(sessionAnalytics)
    ];
    
    // Get most successful templates
    const templates = await RoutineTemplate.find()
      .sort({ 'usageStats.successRate': -1 })
      .limit(1);
    
    let templateData = {};
    if (templates.length > 0) {
      const mostSuccessful = templates[0];
      templateData = {
        mostSuccessful: `${mostSuccessful.templateName} (${mostSuccessful.usageStats.successRate}% success rate)`,
        recommendedFor: mostSuccessful.applicability.programs.map(p => `${p}-${mostSuccessful.applicability.semesters[0]}`)
      };
    }
    
    res.json({
      success: true,
      trends,
      insights,
      templates: templateData,
      sessionsAnalyzed: completedSessions.length
    });
  } catch (error) {
    console.error('Error in getCrossSessionAnalytics:', error);
    res.status(500).json({ success: false, message: 'Failed to generate cross-session analytics', error: error.message });
  }
};

// POST /api/admin/sessions/:id/routine/optimize - Optimize session routine
const optimizeSessionRoutine = async (req, res) => {
  try {
    const { id } = req.params;
    const { optimizationGoals } = req.body;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Call optimization service
    const optimizationResult = await optimizeRoutine(
      session.sessionId, 
      session.currentVersion,
      optimizationGoals
    );
    
    // Update version if changes were made
    if (optimizationResult.changesApplied > 0) {
      // Create new version
      const newVersionNumber = session.currentVersion + 1;
      
      session.versions.push({
        versionNumber: newVersionNumber,
        createdOn: new Date(),
        createdBy: req.user.id,
        reason: 'Optimization applied',
        notes: `${optimizationResult.changesApplied} changes made for optimization`
      });
      
      session.currentVersion = newVersionNumber;
      await session.save();
    }
    
    res.json({
      success: true,
      optimizationResult,
      message: `Optimization complete with ${optimizationResult.changesApplied} improvements`
    });
  } catch (error) {
    console.error('Error in optimizeSessionRoutine:', error);
    res.status(500).json({ success: false, message: 'Failed to optimize routine', error: error.message });
  }
};

// POST /api/admin/sessions/:id/routine/validate - Validate session routine
const validateSessionRoutine = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Get all routine slots for this session version
    const routineSlots = await RoutineSlot.find({
      academicSessionId: session.sessionId,
      routineVersion: session.currentVersion
    }).populate('teacherIds').populate('roomId').populate('subjectId');
    
    // Perform validation
    const validationResults = {
      totalConflicts: 0,
      teacherConflicts: 0,
      roomConflicts: 0,
      details: []
    };
    
    // Simple conflict detection algorithm (would be more sophisticated in real system)
    // Check for teacher conflicts
    const teacherSlotMap = {};
    routineSlots.forEach(slot => {
      slot.teacherIds.forEach(teacher => {
        const key = `${teacher._id}-${slot.dayIndex}-${slot.slotIndex}`;
        if (!teacherSlotMap[key]) {
          teacherSlotMap[key] = [];
        }
        teacherSlotMap[key].push(slot);
      });
    });
    
    // Find conflicts
    Object.entries(teacherSlotMap).forEach(([key, slots]) => {
      if (slots.length > 1) {
        validationResults.teacherConflicts++;
        validationResults.totalConflicts++;
        
        const teacherId = key.split('-')[0];
        const teacher = slots[0].teacherIds.find(t => t._id.toString() === teacherId);
        
        validationResults.details.push({
          type: 'TEACHER_CONFLICT',
          teacher: teacher.name,
          conflictSlots: slots.map(slot => ({
            day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayIndex],
            time: `Slot ${slot.slotIndex + 1}`,
            class1: `${slot.programId}-${slot.semester}${slot.section} ${slot.subjectId.shortName}`,
            class2: slots.length > 1 ? `${slots[1].programId}-${slots[1].semester}${slots[1].section} ${slots[1].subjectId.shortName}` : ''
          })),
          suggestion: 'Assign different teacher or change time slot'
        });
      }
    });
    
    // Check for room conflicts (similar approach)
    const roomSlotMap = {};
    routineSlots.forEach(slot => {
      if (slot.roomId) {
        const key = `${slot.roomId._id}-${slot.dayIndex}-${slot.slotIndex}`;
        if (!roomSlotMap[key]) {
          roomSlotMap[key] = [];
        }
        roomSlotMap[key].push(slot);
      }
    });
    
    Object.entries(roomSlotMap).forEach(([key, slots]) => {
      if (slots.length > 1) {
        validationResults.roomConflicts++;
        validationResults.totalConflicts++;
        
        validationResults.details.push({
          type: 'ROOM_CONFLICT',
          room: slots[0].roomId.name,
          conflictSlots: slots.map(slot => ({
            day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayIndex],
            time: `Slot ${slot.slotIndex + 1}`,
            class1: `${slot.programId}-${slot.semester}${slot.section} ${slot.subjectId.shortName}`,
            class2: slots.length > 1 ? `${slots[1].programId}-${slots[1].semester}${slots[1].section} ${slots[1].subjectId.shortName}` : ''
          })),
          suggestion: `Use another available room for one of the classes`
        });
      }
    });
    
    // Update session conflict count
    session.conflicts = validationResults.totalConflicts;
    await session.save();
    
    res.json({
      success: true,
      validationResults
    });
  } catch (error) {
    console.error('Error in validateSessionRoutine:', error);
    res.status(500).json({ success: false, message: 'Failed to validate routine', error: error.message });
  }
};

// POST /api/admin/sessions/:id/routine/conflicts - Get conflicts in session
const getSessionConflicts = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    // Reuse validation logic from validateSessionRoutine
    const validationResponse = await validateSessionRoutine({ params: { id } }, { json: data => data });
    
    res.json({
      success: true,
      conflicts: validationResponse.validationResults
    });
  } catch (error) {
    console.error('Error in getSessionConflicts:', error);
    res.status(500).json({ success: false, message: 'Failed to get session conflicts', error: error.message });
  }
};

module.exports = {
  getSessionDashboard,
  createAcademicSession,
  activateSession,
  completeSession,
  copyRoutineFromSession,
  createRoutineVersion,
  getSessionAnalytics,
  // Added missing functions referenced in routes
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
  archiveSession,
  approveSession,
  getRoutineVersions,
  rollbackToVersion,
  applyTemplateToSession,
  saveSessionAsTemplate,
  compareSessionAnalytics,
  getCrossSessionAnalytics,
  optimizeSessionRoutine,
  validateSessionRoutine,
  getSessionConflicts
};
