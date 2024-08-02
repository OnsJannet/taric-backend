const express = require('express');
const axios = require('axios');
const cors = require('cors');
const translate = require('@vitalets/google-translate-api'); // Add the translation library

const app = express();
const port = 5000;

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json());

// Function to translate suggestions to Italian
const translateToItalian = async (suggestions) => {
  for (let suggestion of suggestions) {
    const translation = await translate(suggestion.value, { from: 'en', to: 'it' });
    suggestion.value = translation.text;
  }
  return suggestions;
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
    // Translate search term from Italian to English
    try {
      const translation = await translate(term, { from: 'it', to: 'en' });
      searchTerm = translation.text;
      targetLang = 'en'; // Search in English
    } catch (error) {
      console.error('Error translating search term:', error);
      return res.status(500).send('Error translating search term');
    }
  }

  const url = `https://www.tarifdouanier.eu/api/v2/cnSuggest?term=${encodeURIComponent(searchTerm)}&lang=${encodeURIComponent(targetLang)}`;

  try {
    const response = await axios.get(url);
    let suggestions = response.data.suggestions || [];

    // Translate to Italian if required
    if (lang === 'it') {
      suggestions = await translateToItalian(suggestions);
    }

    const categorizedSuggestions = {
      category: suggestions.filter(s => s.code.length === 4),
      family: suggestions.filter(s => s.code.length === 6),
      suggestions: suggestions.filter(s => s.code.length !== 4 && s.code.length !== 6),
    };

    res.json(categorizedSuggestions);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
