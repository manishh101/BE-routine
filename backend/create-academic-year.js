const mongoose = require('mongoose');
const AcademicCalendar = require('./models/AcademicCalendar');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://079bct044manish:routine@routine.mrjj7ho.mongodb.net/bctroutine?retryWrites=true&w=majority&appName=routine');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const createAcademicYear = async () => {
  try {
    await connectDB();

    // Check if there's already a current academic year
    const existingCurrent = await AcademicCalendar.findOne({ isCurrentYear: true });
    
    if (existingCurrent) {
      console.log('✅ Current academic year already exists:', existingCurrent.title);
      process.exit(0);
    }

    // Create a new academic calendar for current year
    const academicYear = new AcademicCalendar({
      title: 'Academic Year 2081-2082',
      nepaliYear: '2081-2082',
      englishYear: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-08-31'),
      isCurrentYear: true,
      isActive: true,
      semesters: [
        {
          name: 'First Semester',
          startDate: new Date('2024-09-01'),
          endDate: new Date('2025-01-15'),
          examStartDate: new Date('2024-12-20'),
          examEndDate: new Date('2025-01-15'),
          isActive: true
        },
        {
          name: 'Second Semester',
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-08-31'),
          examStartDate: new Date('2025-06-15'),
          examEndDate: new Date('2025-07-15'),
          isActive: true
        }
      ]
    });

    await academicYear.save();
    console.log('✅ Academic year created successfully:', academicYear.title);
    console.log('📅 Year:', academicYear.nepaliYear, '(' + academicYear.englishYear + ')');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating academic year:', error);
    process.exit(1);
  }
};

createAcademicYear();
