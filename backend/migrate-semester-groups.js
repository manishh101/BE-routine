/**
 * Migration script to update semesterGroup values for existing RoutineSlot records
 * This fixes the issue where old records have semesterGroup calculated with conventional odd/even logic
 * New logic: odd group = [2,4,5,7], even group = [1,3,6,8]
 */

const mongoose = require('mongoose');
const RoutineSlot = require('./models/RoutineSlot');
const { getSemesterGroupName } = require('./utils/semesterGroupUtils');

async function updateSemesterGroups() {
  try {
    console.log('🔄 Starting semesterGroup migration...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/routine-management');
    
    // Get all routine slots
    const routineSlots = await RoutineSlot.find({});
    console.log(`📊 Found ${routineSlots.length} routine slots to check`);
    
    let updatedCount = 0;
    let correctCount = 0;
    
    for (const slot of routineSlots) {
      const currentGroup = slot.semesterGroup;
      const correctGroup = getSemesterGroupName(slot.semester);
      
      if (currentGroup !== correctGroup) {
        console.log(`🔧 Updating slot ${slot._id}: semester ${slot.semester} from "${currentGroup}" to "${correctGroup}"`);
        
        await RoutineSlot.updateOne(
          { _id: slot._id },
          { semesterGroup: correctGroup }
        );
        updatedCount++;
      } else {
        correctCount++;
      }
    }
    
    console.log(`✅ Migration completed:`);
    console.log(`   - ${updatedCount} records updated`);
    console.log(`   - ${correctCount} records already correct`);
    console.log(`   - ${routineSlots.length} total records processed`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  updateSemesterGroups();
}

module.exports = { updateSemesterGroups };
