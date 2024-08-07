const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const passport = require('passport');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const goodsRoutes = require('./routes/goodsRoutes');
require('dotenv').config();


require('./config/passport')(passport);

const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser()); // Make sure to use cookieParser before csrf
app.use(passport.initialize());

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Route to get CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/goods', goodsRoutes);

// Global error handler for CSRF errors
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next(err);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
