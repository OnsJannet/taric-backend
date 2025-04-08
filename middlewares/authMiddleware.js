const passport = require('passport');
const { ApiError } = require('./errorMiddleware');

/**
 * Middleware to protect routes with JWT authentication
 */
const protect = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(new ApiError(500, 'Authentication error', false, err.stack));
    }
    
    if (!user) {
      return next(new ApiError(401, info?.message || 'Unauthorized - Invalid token', true));
    }
    
    // Add user to request
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Middleware to check if user has admin role
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    next(new ApiError(403, 'Not authorized as an admin', true));
  }
};

/**
 * Middleware to validate request origin
 */
const validateOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  
  if (process.env.NODE_ENV === 'production' && origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return next(new ApiError(403, 'Origin not allowed', true));
  }
  
  next();
};

module.exports = { 
  protect,
  admin,
  validateOrigin
};
