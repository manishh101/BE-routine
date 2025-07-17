const Program = require('../models/Program');
const { validationResult } = require('express-validator');

// @desc    Create a new program
// @route   POST /api/programs
// @access  Private/Admin
exports.createProgram = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const program = new Program(req.body);
    await program.save();
    res.status(201).json(program);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'Program with this name or code already exists' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Get all programs
// @route   GET /api/programs
// @access  Private
exports.getPrograms = async (req, res) => {
  try {
    const programs = await Program.find();
    res.json(programs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get program by ID
// @route   GET /api/programs/:id
// @access  Private
exports.getProgramById = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ msg: 'Program not found' });
    }

    res.json(program);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Program not found' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Update program
// @route   PUT /api/programs/:id
// @access  Private/Admin
exports.updateProgram = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let program = await Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ msg: 'Program not found' });
    }

    program = await Program.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.json(program);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Program not found' });
    }
    res.status(500).send('Server error');
  }
};

// @desc    Delete program
// @route   DELETE /api/programs/:id
// @access  Private/Admin
exports.deleteProgram = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ msg: 'Program not found' });
    }

    await program.remove();

    res.json({ msg: 'Program removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Program not found' });
    }
    res.status(500).send('Server error');
  }
};
