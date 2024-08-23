const express = require('express');
const router = express.Router();
const axios = require('axios');
const { check, validationResult } = require('express-validator');
const fs = require('fs').promises;
require('dotenv').config();

// Mock goods data variable
let goodsData = [];
let italianGoodsData = [];

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

// Load Italian goods data from local JSON file
const loadItalianGoodsData = async () => {
  try {
    const data = await fs.readFile('scraped_data_it.json', 'utf-8');
    italianGoodsData = JSON.parse(data);
  } catch (error) {
    console.error('Error loading scraped_data_it.json:', error);
  }
};

// Initialize goodsData and italianGoodsData
loadGoodsData();
loadItalianGoodsData();

// Function to translate text using Google Translate API
const translateText = async (text, targetLang) => {
  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const response = await axios.post(
      url,
      {
        q: text,
        target: targetLang,
        source: 'it'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.data.translations[0].translatedText;
  } catch (error) {
    console.error('Translation error:', error.response ? error.response.data : error.message);
    return text;
  }
};

// Function to compare codes and find matching descriptions in Italian goods data
const compareCodesWithItalianGoodsData = (code) => {
  // Remove spaces from the code to match the format
  const formattedCode = code.replace(/\s+/g, '');

  // Find matching entry in the Italian goods data
  const match = italianGoodsData.find(item => item.code.replace(/\s+/g, '') === formattedCode);
  if (match) {
    return match.description.split(':')[0].trim(); // Remove everything after the colon
  }
  return null; // Return null if no match is found
};

// Helper function to replace descriptions in suggestions based on the language
const replaceDescriptions = (suggestions, lang) => {
  return suggestions.reduce((acc, s) => {
    const italianDescription = lang === 'it' ? compareCodesWithItalianGoodsData(s.code) : s.value;
    
    // Only include the suggestion if the description is found
    if (italianDescription) {
      acc.push({
        ...s,
        value: italianDescription
      });
    }

    return acc;
  }, []);
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

    // Categorize suggestions by code length
    const categorizedSuggestions = {
      category: suggestions.filter(s => s.code.length === 4),
      family: suggestions.filter(s => s.code.length === 6),
      suggestions: suggestions.filter(s => s.code.length !== 4 && s.code.length !== 6),
    };

    // Update all categorized suggestions with descriptions from Italian goods data
    const updatedCategorizedSuggestions = {
      category: replaceDescriptions(categorizedSuggestions.category, lang),
      family: replaceDescriptions(categorizedSuggestions.family, lang),
      suggestions: replaceDescriptions(categorizedSuggestions.suggestions, lang)
    };

    // Update matchedSuggestions as well
    const matchedSuggestions = replaceDescriptions(categorizedSuggestions.suggestions, lang);

    res.json({ categorizedSuggestions: updatedCategorizedSuggestions, matchedSuggestions });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
