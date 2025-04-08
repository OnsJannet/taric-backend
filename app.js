// backend/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');
const requestLogger = require('./middlewares/requestLoggerMiddleware');
const { validateOrigin } = require('./middlewares/authMiddleware');
const connectDB = require('./config/db');
const logger = require('./utils/loggerUtil');
require('dotenv').config();

// Import routes
const elasticRoutes = require('./routes/elasticRoutes');
const goodsRoutes = require('./routes/goodsRoutes');
const descriptionRoutes = require('./routes/descriptionRoutes');
const fuzzywuzzyRoutes = require('./routes/fuzzywuzzyRoutes');
const cartRoutes = require('./routes/cartRoutes');
const authRoutes = require('./routes/authRoutes');

// Initialize express app
const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
if (process.env.MONGO_URI) {
  connectDB();
}

// Configure passport
require('./config/passport')(passport);

// Global rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Security middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Restrict to specific origins in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(validateOrigin); // Validate request origin

// Body parsing middleware
app.use(express.json({ limit: '50mb' })); // Parse JSON with increased limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies

// Authentication middleware
app.use(passport.initialize()); // Initialize passport

// Logging middleware
app.use(requestLogger); // Log all requests

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// API Routes
app.use('/api/elastic', elasticRoutes);
app.use('/api/goods', goodsRoutes);
app.use('/api/description', descriptionRoutes);
app.use('/api/fuzzy', fuzzywuzzyRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/auth', authRoutes);

// Legacy route for backward compatibility
app.get('/api/suggestions', async (req, res) => {
  logger.info('Legacy route accessed', { redirectTo: '/api/elastic/suggestions' });
  // Redirect to the new endpoint
  res.redirect(`/api/elastic/suggestions?${new URLSearchParams(req.query)}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const server = app.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}`, { 
    environment: process.env.NODE_ENV || 'development',
    port
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection', { error: err.message, stack: err.stack });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  // In production, you might want to restart the process here
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = app; // Export for testing
