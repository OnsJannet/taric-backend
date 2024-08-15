const express = require('express');
const { check, validationResult } = require('express-validator');

const router = express.Router();

// Sample data for demonstration; replace this with your actual data loading
const scrapedDataEn = require('../scraped_data_en.json');
const scrapedDataIt = require('../scraped_data_it.json');

// Function to clean HTML tags from descriptions
const stripHtmlTags = (text) => text.replace(/<\/?[^>]+>/gi, '').trim();

// Function to extract text before a specific HTML tag
const extractTextBeforeTag = (text) => {
  // Adjusted regular expression to capture text before the <a> tag
  const regex = /(.*?)(?:\s*<a\s+class="ecl-link.*?>.*<\/a>)$/i;
  const match = text.match(regex);
  return match ? match[1].trim() : text;
};

// Function to perform search
const search = (data, term) => {
  console.log('Searching for term:', term);
  console.log('Data length:', data.length); 

  // Clean and normalize term
  const cleanedTerm = term.toLowerCase().trim();
  console.log('Cleaned term:', cleanedTerm);

  const results = data.filter(item => {
    let cleanedDescription = stripHtmlTags(item.description).toLowerCase().trim();
    // Extract text before the specific HTML tag
    cleanedDescription = extractTextBeforeTag(cleanedDescription);
    console.log('Cleaned Description:', cleanedDescription);
    // Check if term is included in description
    return cleanedDescription.includes(cleanedTerm);
  });

  console.log('Results:', results);
  return results;
};

// API route to fetch suggestions
router.get('/suggestions', [
  check('term').notEmpty().withMessage('Term is required'),
  check('lang').notEmpty().withMessage('Language is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors.array());
  }

  const { term, lang } = req.query;
  const data = lang === 'it' ? scrapedDataIt : scrapedDataEn;

  // Console log the term and the data being searched
  console.log('Requested term:', term);
  console.log('Data source:', lang === 'it' ? 'scrapedDataIt' : 'scrapedDataEn');

  try {
    const results = search(data, term);
    res.json({ results });
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
