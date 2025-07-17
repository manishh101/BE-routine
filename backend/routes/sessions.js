const express = require('express');
const router = express.Router();
const {
  getSessionDashboard,
  createAcademicSession,
  activateSession,
  completeSession,
  copyRoutineFromSession,
  createRoutineVersion,
  getSessionAnalytics,
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
} = require('../controllers/sessionController');

const { protect, requireAdmin } = require('../middleware/auth');

// All session management routes require admin privileges
router.use(protect);
router.use(requireAdmin);

// Dashboard and Overview
router.get('/dashboard', getSessionDashboard);

// Session CRUD Operations
router.post('/create', createAcademicSession);
router.get('/', getAllSessions);
router.get('/:id', getSessionById);
router.put('/:id', updateSession);
router.delete('/:id', deleteSession);

// Session Lifecycle Management
router.put('/:id/activate', activateSession);
router.put('/:id/complete', completeSession);
router.put('/:id/archive', archiveSession);
router.put('/:id/approve', approveSession);

// Routine Management within Sessions
router.post('/:id/routine/copy-from/:sourceId', copyRoutineFromSession);
router.put('/:id/routine/version', createRoutineVersion);
router.get('/:id/routine/versions', getRoutineVersions);
router.put('/:id/routine/rollback/:version', rollbackToVersion);

// Template Operations
router.post('/:id/routine/apply-template/:templateId', applyTemplateToSession);
router.post('/:id/routine/save-as-template', saveSessionAsTemplate);

// Analytics and Reporting
router.get('/:id/analytics', getSessionAnalytics);
router.get('/:id/analytics/comparison/:compareSessionId', compareSessionAnalytics);
router.get('/analytics/cross-session', getCrossSessionAnalytics);

// Session Planning Tools
router.post('/:id/routine/optimize', optimizeSessionRoutine);
router.post('/:id/routine/validate', validateSessionRoutine);
router.post('/:id/routine/conflicts', getSessionConflicts);

module.exports = router;
