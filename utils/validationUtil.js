/**
 * Utility for common validation functions
 */
const { check } = require('express-validator');

/**
 * Common validation rules for user-related routes
 */
const userValidation = {
  // User registration validation
  register: [
    check('name')
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    
    check('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    check('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/\d/).withMessage('Password must contain a number')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
  ],

  // User login validation
  login: [
    check('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    check('password')
      .notEmpty().withMessage('Password is required')
  ],

  // Password update validation
  updatePassword: [
    check('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    
    check('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
      .matches(/\d/).withMessage('New password must contain a number')
      .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
  ]
};

/**
 * Common validation rules for cart-related routes
 */
const cartValidation = {
  // Add item to cart validation
  addItem: [
    check('code')
      .notEmpty().withMessage('Product code is required'),
    
    check('quantity')
      .notEmpty().withMessage('Quantity is required')
      .isInt({ min: 1 }).withMessage('Quantity must be at least 1')
  ]
};

/**
 * Common validation rules for search-related routes
 */
const searchValidation = {
  // Basic search validation
  search: [
    check('term')
      .notEmpty().withMessage('Search term is required')
      .isLength({ min: 2 }).withMessage('Search term must be at least 2 characters'),
    
    check('lang')
      .notEmpty().withMessage('Language is required')
      .isIn(['en', 'it']).withMessage('Language must be either "en" or "it"')
  ]
};

module.exports = {
  userValidation,
  cartValidation,
  searchValidation
};
