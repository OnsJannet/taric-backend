const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 5000;

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json());

let goodsData = [];

// Load the JSON data
fs.readFile('taric.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading taric.json:', err);
  } else {
    const parsedData = JSON.parse(data);
    goodsData = parsedData.Sheet1 || []; // Adjust to match your JSON structure
  }
});

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
app.get('/api/suggestions', async (req, res) => {
  const { term, lang } = req.query;

  if (!term || !lang) {
    return res.status(400).send('Term and language are required');
  }

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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
