#!/usr/bin/env node
/**
 * Database Index Creation Script
 * Run: node backend/scripts/create-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function createIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    console.log('\n📊 Creating indexes...\n');
    
    // Helper function to safely create index
    const safeCreateIndex = async (collection, indexSpec) => {
      try {
        await db.collection(collection).createIndex(indexSpec.key, {
          name: indexSpec.name,
          background: true,
          ...(indexSpec.sparse && { sparse: true }),
          ...(indexSpec.unique && { unique: true }),
        });
        console.log(`  ✅ Created index: ${indexSpec.name}`);
      } catch (error) {
        if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
          console.log(`  ⚠️  Index already exists: ${indexSpec.name}`);
        } else if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          console.log(`  ⚠️  Index with same keys exists: ${indexSpec.name}`);
        } else {
          console.error(`  ❌ Error creating ${indexSpec.name}:`, error.message);
        }
      }
    };
    
    // RoutineSlot indexes
    console.log('Creating RoutineSlot indexes...');
    await safeCreateIndex('routineslots', { key: { programCode: 1, semester: 1, section: 1 }, name: 'idx_routine_basic' });
    await safeCreateIndex('routineslots', { key: { dayIndex: 1, slotIndex: 1 }, name: 'idx_time_slot' });
    await safeCreateIndex('routineslots', { key: { teacherIds: 1, dayIndex: 1, slotIndex: 1 }, name: 'idx_teacher_schedule' });
    await safeCreateIndex('routineslots', { key: { roomId: 1, dayIndex: 1, slotIndex: 1 }, name: 'idx_room_schedule' });
    await safeCreateIndex('routineslots', { key: { academicYearId: 1, programCode: 1, semester: 1 }, name: 'idx_academic_year' });
    await safeCreateIndex('routineslots', { key: { programCode: 1, semester: 1, section: 1, dayIndex: 1 }, name: 'idx_routine_fetch' });
    await safeCreateIndex('routineslots', { key: { spanId: 1 }, name: 'idx_span_group', sparse: true });
    console.log('✅ RoutineSlot indexes processed');
    
    // Teacher indexes
    console.log('\nCreating Teacher indexes...');
    await safeCreateIndex('teachers', { key: { fullName: 'text', shortName: 'text' }, name: 'idx_teacher_search' });
    await safeCreateIndex('teachers', { key: { isActive: 1 }, name: 'idx_active_teachers' });
    await safeCreateIndex('teachers', { key: { department: 1 }, name: 'idx_department' });
    await safeCreateIndex('teachers', { key: { email: 1 }, name: 'idx_teacher_email', unique: true, sparse: true });
    console.log('✅ Teacher indexes processed');
    
    // Room indexes
    console.log('\nCreating Room indexes...');
    await safeCreateIndex('rooms', { key: { name: 'text', code: 'text' }, name: 'idx_room_search' });
    await safeCreateIndex('rooms', { key: { type: 1 }, name: 'idx_room_type' });
    await safeCreateIndex('rooms', { key: { capacity: 1 }, name: 'idx_room_capacity' });
    await safeCreateIndex('rooms', { key: { building: 1, floor: 1 }, name: 'idx_room_location' });
    console.log('✅ Room indexes processed');
    
    // Subject indexes
    console.log('\nCreating Subject indexes...');
    // Note: Skip unique index if there are duplicate codes in the database
    try {
      await safeCreateIndex('subjects', { key: { code: 1 }, name: 'idx_subject_code', unique: true });
    } catch (error) {
      console.log('  ⚠️  Cannot create unique index on subject code - duplicate values exist');
      console.log('  💡 Run: db.subjects.aggregate([{$group:{_id:"$code",count:{$sum:1}}},{$match:{count:{$gt:1}}}]) to find duplicates');
    }
    await safeCreateIndex('subjects', { key: { name: 'text', code: 'text' }, name: 'idx_subject_search' });
    await safeCreateIndex('subjects', { key: { semester: 1, programId: 1 }, name: 'idx_program_semester' });
    console.log('✅ Subject indexes processed');
    
    // Program indexes
    console.log('\nCreating Program indexes...');
    await safeCreateIndex('programs', { key: { code: 1 }, name: 'idx_program_code', unique: true });
    await safeCreateIndex('programs', { key: { name: 'text', code: 'text' }, name: 'idx_program_search' });
    console.log('✅ Program indexes processed');
    
    // TimeSlot indexes
    console.log('\nCreating TimeSlot indexes...');
    await safeCreateIndex('timeslots', { key: { dayOfWeek: 1, startTime: 1 }, name: 'idx_time_schedule' });
    await safeCreateIndex('timeslots', { key: { label: 1 }, name: 'idx_slot_label' });
    console.log('✅ TimeSlot indexes processed');
    
    // User indexes
    console.log('\nCreating User indexes...');
    await safeCreateIndex('users', { key: { email: 1 }, name: 'idx_user_email', unique: true });
    await safeCreateIndex('users', { key: { username: 1 }, name: 'idx_username', unique: true, sparse: true });
    console.log('✅ User indexes processed');
    
    // Get index statistics
    console.log('\n📊 Index Statistics:\n');
    const collections = ['routineslots', 'teachers', 'rooms', 'subjects', 'programs', 'timeslots', 'users'];
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const stats = await collection.stats();
        const indexes = await collection.indexes();
        console.log(`${collectionName}:`);
        console.log(`  - Documents: ${stats.count || 0}`);
        console.log(`  - Indexes: ${indexes.length}`);
        if (stats.totalIndexSize) {
          console.log(`  - Total Index Size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
        }
      } catch (error) {
        // Skip if collection doesn't exist or stats not available
        console.log(`${collectionName}: Collection stats not available`);
      }
    }
    
    console.log('\n✅ All indexes created successfully!');
    console.log('\n💡 Tips:');
    console.log('  - Run this script after major schema changes');
    console.log('  - Monitor index usage with: db.collection.aggregate([{$indexStats:{}}])');
    console.log('  - Drop unused indexes to save space');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the script
createIndexes();
