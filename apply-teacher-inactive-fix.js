const fs = require('fs');
const path = require('path');

// Files to update
const updates = [
  {
    file: 'backend/controllers/routineSlotController.js',
    search: /Teacher\.find\(\{ _id: \{ \$in: teacherIds \} \}\)/g,
    replace: 'Teacher.find({ _id: { $in: teacherIds }, isActive: true })'
  },
  {
    file: 'backend/services/UnifiedPDFService.js',
    search: /await Teacher\.find\(\{ _id: \{ \$in: teacherIds \} \}\)\.sort\(\{ fullName: 1 \}\)/g,
    replace: 'await Teacher.find({ _id: { $in: teacherIds }, isActive: true }).sort({ fullName: 1 })'
  },
  {
    file: 'backend/services/PDFRoutineService_OLD.js',
    search: /await Teacher\.find\(\{ _id: \{ \$in: teacherIds \} \}\)\.sort\(\{ fullName: 1 \}\)/g,
    replace: 'await Teacher.find({ _id: { $in: teacherIds }, isActive: true }).sort({ fullName: 1 })'
  },
  {
    file: 'backend/services/analyticsService.js',
    search: /const teachers = await Teacher\.find\(\);/g,
    replace: 'const teachers = await Teacher.find({ isActive: true });'
  }
];

updates.forEach(({ file, search, replace }) => {
  const filePath = path.join(__dirname, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const before = content.match(search);
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${file}`);
    if (before) console.log(`  Matched: ${before[0]}`);
  } catch (err) {
    console.error(`✗ Error updating ${file}:`, err.message);
  }
});

console.log('\nAll updates completed!');
