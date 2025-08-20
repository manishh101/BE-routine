const User = require('./models/User');
require('./config/db');

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...');
    
    const users = await User.find({}, 'email isAdmin').limit(5);
    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log(`Email: ${user.email}, Admin: ${user.isAdmin}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setTimeout(checkUsers, 1000);
