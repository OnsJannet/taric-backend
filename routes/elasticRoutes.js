const express = require('express');
const { check, validationResult } = require('express-validator');
const elasticService = require('../services/elasticService');
const { ApiError } = require('../middlewares/errorMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Create a rate limiter for search requests
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Too many search requests from this IP, please try again after a minute'
});

// Load data once at module initialization
const scrapedDataEn = require('../scraped_data_en.json');
const scrapedDataIt = require('../scraped_data_it.json');

/**
 * @route   GET /api/elastic/suggestions
 * @desc    Get suggestions based on search term
 * @access  Public
 */
router.get('/suggestions', [
  searchLimiter,
  check('term').notEmpty().withMessage('Term is required'),
  check('lang').notEmpty().withMessage('Language is required')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, 'Validation error', true, null));
  }

  const { term, lang } = req.query;
  const data = lang === 'it' ? scrapedDataIt : scrapedDataEn;

  try {
    const results = elasticService.search(data, term);
    res.json({ 
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    next(new ApiError(500, `Error performing search: ${error.message}`));
  }
});

module.exports = router;
