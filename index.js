const express = require('express');
const axios = require('axios');
const cors = require('cors');
const translate = require('translate'); // Add a translation library

const app = express();
const port = 5000;

// Set up the translation library
translate.engine = 'libre';
translate.key = 'YOUR_LIBRETRANSLATE_API_KEY'; // Get an API key from LibreTranslate

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json());

const translateToItalian = async (suggestions) => {
  for (let suggestion of suggestions) {
    suggestion.value = await translate(suggestion.value, 'it');
  }
  return suggestions;
};

// API route to fetch suggestions
app.get('/api/suggestions', async (req, res) => {
  const { term, lang } = req.query;

  if (!term || !lang) {
    return res.status(400).send('Term and language are required');
  }

  const targetLang = lang === 'it' ? 'en' : lang; 
  const url = `https://www.tarifdouanier.eu/api/v2/cnSuggest?term=${encodeURIComponent(term)}&lang=${encodeURIComponent(targetLang)}`;

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
