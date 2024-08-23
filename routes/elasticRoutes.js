const express = require('express');
const { check, validationResult } = require('express-validator');

const router = express.Router();

const scrapedDataEn = require('../scraped_data_en.json');
const scrapedDataIt = require('../scraped_data_it.json');

// Function to clean HTML tags from descriptions
const stripHtmlTags = (text) => text.replace(/<\/?[^>]+>/gi, '').trim();

// Function to extract text before a specific HTML tag
const extractTextBeforeTag = (text) => {
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

  // Split the cleaned term into individual words
  const termsArray = cleanedTerm.split(/\s+/);
  console.log('Split terms:', termsArray);

  const resultsMap = {};

  // Search for each term separately
  termsArray.forEach(word => {
    console.log('Searching for word:', word);

    data.forEach(item => {
      let cleanedDescription = stripHtmlTags(item.description).toLowerCase().trim();
      cleanedDescription = extractTextBeforeTag(cleanedDescription);

      console.log('Description:', cleanedDescription);

      if (cleanedDescription.includes(word)) {
        if (!resultsMap[item.code]) {
          resultsMap[item.code] = { item, matchCount: 0 };
        }
        resultsMap[item.code].matchCount += 1;
      }
    });
  });

  // Convert the map to an array and sort by match count
  const results = Object.values(resultsMap)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map(result => result.item);

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
