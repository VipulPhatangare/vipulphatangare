require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/research', require('./routes/research'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/apikeys', require('./routes/apikeys'));

// Serve static files (profile image)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
