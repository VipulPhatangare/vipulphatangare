require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const NEW_PASSWORD = process.env.ADMIN_PASSWORD;

if (!NEW_PASSWORD) {
  console.error('ADMIN_PASSWORD not set in .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const Admin = require('./models/Admin');

    const hashed = await bcrypt.hash(NEW_PASSWORD, 12);
    const result = await Admin.updateOne({}, { password: hashed });

    if (result.modifiedCount > 0) {
      console.log('Password updated in MongoDB to:', NEW_PASSWORD);
    } else if (result.matchedCount === 0) {
      await Admin.create({ email: process.env.ADMIN_EMAIL, password: NEW_PASSWORD });
      console.log('Admin created with password:', NEW_PASSWORD);
    } else {
      console.log('Admin found but password unchanged.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
