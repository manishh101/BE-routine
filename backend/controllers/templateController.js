const RoutineTemplate = require('../models/RoutineTemplate');
const AcademicSession = require('../models/AcademicSession');
const { generateTemplateAnalytics } = require('../services/analyticsService');

// GET /api/admin/templates - Get all templates
const getAllTemplates = async (req, res) => {
  try {
    const { 
      category, 
      program,
      semester,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (category) filter.category = category;
    if (program) filter.applicableTo.program = program;
    if (semester) filter.applicableTo.semester = semester;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const templates = await RoutineTemplate.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');

    const total = await RoutineTemplate.countDocuments(filter);

    res.json({
      success: true,
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllTemplates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
  }
};

// GET /api/admin/templates/:id - Get template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await RoutineTemplate.findById(id)
      .populate('createdBy', 'name email');

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error in getTemplateById:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch template', error: error.message });
  }
};

// POST /api/admin/templates - Create a new template
const createTemplate = async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      createdBy: req.user.id,
      createdAt: new Date()
    };

    const template = await RoutineTemplate.create(templateData);

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error in createTemplate:', error);
    res.status(500).json({ success: false, message: 'Failed to create template', error: error.message });
  }
};

// PUT /api/admin/templates/:id - Update template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check for existence
    const template = await RoutineTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Add audit trail
    updateData.lastModified = {
      date: new Date(),
      userId: req.user.id,
      reason: updateData.updateReason || 'General update'
    };

    const updatedTemplate = await RoutineTemplate.findByIdAndUpdate(
      id, 
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Template updated successfully',
      template: updatedTemplate
    });
  } catch (error) {
    console.error('Error in updateTemplate:', error);
    res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
  }
};

// DELETE /api/admin/templates/:id - Delete template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const template = await RoutineTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Delete template
    await RoutineTemplate.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteTemplate:', error);
    res.status(500).json({ success: false, message: 'Failed to delete template', error: error.message });
  }
};

// GET /api/admin/templates/:id/analytics - Get template analytics
const getTemplateAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const template = await RoutineTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Generate analytics
    const analytics = await generateTemplateAnalytics(template);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error in getTemplateAnalytics:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template analytics', error: error.message });
  }
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateAnalytics
};
