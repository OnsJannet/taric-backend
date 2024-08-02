
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 5000;

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json());

// API route to fetch suggestions
app.get('/api/suggestions', async (req, res) => {
  const { term, lang } = req.query;

  if (!term || !lang) {
    return res.status(400).send('Term and language are required');
  }

  const url = `https://www.tarifdouanier.eu/api/v2/cnSuggest?term=${encodeURIComponent(term)}&lang=${encodeURIComponent(lang)}`;

  try {
    const response = await axios.get(url);
    const suggestions = response.data.suggestions || [];

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
