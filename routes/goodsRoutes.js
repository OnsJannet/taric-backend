const express = require('express');
const router = express.Router();
const axios = require('axios');
const { check, validationResult } = require('express-validator');

// Mock goods data variable
let goodsData = [];

// Fetch the JSON data from the URL
const loadGoodsData = async () => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/OnsJannet/taric-backend/e529cf1b638f3b03a4b32d4716ea7d09d7802a81/taric.json');
    const parsedData = response.data;
    goodsData = parsedData.Sheet1 || [];
  } catch (error) {
    console.error('Error fetching taric.json:', error);
  }
};

// Initialize goodsData
loadGoodsData();

// Function to translate text
const translateText = async (text, targetLang) => {
  try {
    const response = await axios.post('https://libretranslate.de/translate', {
      q: text,
      source: 'en',
      target: targetLang,
      format: 'text'
    });
    return response.data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return the original text in case of error
  }
};

// Function to compare codes
const compareCodes = (code, goodsData) => {
  const prefix = code; // Adjust prefix length as needed
  const matches = goodsData.filter(item => item['Goodscode'] && item['Goodscode'].toString().startsWith(prefix));
  return matches;
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

  let searchTerm = term;
  let targetLang = lang;

  if (lang === 'it') {
    searchTerm = await translateText(term, 'en'); // Translate Italian term to English
    targetLang = 'en';
  }

  const url = `https://www.tarifdouanier.eu/api/v2/cnSuggest?term=${encodeURIComponent(searchTerm)}&lang=${encodeURIComponent(targetLang)}`;
  console.log("url", url);
  try {
    const response = await axios.get(url);
    const suggestions = response.data.suggestions || [];

    const categorizedSuggestions = {
      category: suggestions.filter(s => s.code.length === 4),
      family: suggestions.filter(s => s.code.length === 6),
      suggestions: suggestions.filter(s => s.code.length !== 4 && s.code.length !== 6),
    };

    // Compare only suggestions with codes other than lengths 4 and 6
    const matchedSuggestions = categorizedSuggestions.suggestions.map(s => ({
      ...s,
      matches: compareCodes(s.code, goodsData)
    }));

    if (lang === 'it') {
      // Translate results back to Italian
      for (const suggestion of categorizedSuggestions.suggestions) {
        suggestion.value = await translateText(suggestion.value, 'it');
      }
    }

    res.json({ categorizedSuggestions, matchedSuggestions });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;