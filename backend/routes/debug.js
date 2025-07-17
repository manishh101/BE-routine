const express = require('express');
const router = express.Router();
const RoutineSlot = require('../models/RoutineSlot');

// Debug route to check multi-group data
router.get('/multi-groups/:programCode/:semester/:section', async (req, res) => {
  try {
    const { programCode, semester, section } = req.params;

    const slots = await RoutineSlot.find({
      programCode: programCode.toUpperCase(),
      semester: parseInt(semester),
      section: section.toUpperCase(),
      isActive: true
    }).sort({ dayIndex: 1, slotIndex: 1, labGroup: 1 });

    const multiGroupSlots = slots.filter(slot => slot.labGroup && ['A', 'B'].includes(slot.labGroup));

    console.log(`Found ${slots.length} total slots, ${multiGroupSlots.length} multi-group slots`);

    res.json({
      success: true,
      data: {
        totalSlots: slots.length,
        multiGroupSlots: multiGroupSlots.length,
        slots: slots.map(slot => ({
          _id: slot._id,
          dayIndex: slot.dayIndex,
          slotIndex: slot.slotIndex,
          labGroup: slot.labGroup,
          subjectId: slot.subjectId,
          spanId: slot.spanId,
          spanMaster: slot.spanMaster
        })),
        multiGroupDetails: multiGroupSlots.map(slot => ({
          _id: slot._id,
          dayIndex: slot.dayIndex,
          slotIndex: slot.slotIndex,
          labGroup: slot.labGroup,
          subjectId: slot.subjectId,
          spanId: slot.spanId
        }))
      }
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug route error',
      error: error.message
    });
  }
});

module.exports = router;
