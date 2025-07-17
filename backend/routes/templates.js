const express = require('express');
const router = express.Router();
const {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateAnalytics
} = require('../controllers/templateController');

const { protect, requireAdmin } = require('../middleware/auth');

// All template management routes require admin privileges
router.use(protect);
router.use(requireAdmin);

// Template CRUD Operations
router.get('/', getAllTemplates);
router.get('/:id', getTemplateById);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

// Template Analytics
router.get('/:id/analytics', getTemplateAnalytics);

module.exports = router;
