const fuzzball = require("fuzzball");
const express = require("express");
const router = express.Router();

// Normalize function to remove special characters, trim, make lowercase, and replace |% with %
const normalizeString = (str) => {
  return str
    .toLowerCase() // Convert to lowercase
    .replace(/[\r\n\t]/g, "") // Remove line breaks and tabs
    .replace(/\|%/g, "%") // Replace occurrences of '|%' with '%'
    .replace(/[^a-z0-9\s%+\-\/|]/g, "") // Remove only irrelevant special characters, leave %, +, -, /, |
    .trim(); // Remove leading/trailing spaces
};

// Function to get the best matches based on the highest scores
const getBestMatches = (items, topCount = 3) => {
  // Sort the items by score in descending order
  const sortedItems = [...items].sort((a, b) => b.Code.score - a.Code.score);

  // Get the top `topCount` items
  return sortedItems.slice(0, topCount);
};

// Recursive function to add score to the items and their nested subs
const fuzzySearch = (word, language, json) => {
  if (!word || !language || !json) {
    console.log("Entered the fuzzySearch: word, language, and json are required.");
    throw new Error("word, language, and json fields are required.");
  }

  const normalizedWord = normalizeString(word); // Normalize the word

  // Recursive function to add scores to items
  const addScoreToItems = (item) => {
    // Ensure that item.Code exists before trying to access Description
    if (item.Code) {
      const descriptionField = language === "en" ? "DescriptionEN" : "Description";
      const description = item.Code[descriptionField];

      if (description) {
        const normalizedDescription = normalizeString(description); // Normalize the entire description

        // Use fuzzball.ratio to compare the word and the entire description
        const score = fuzzball.ratio(normalizedWord, normalizedDescription);

        // Add score to the item’s Code field
        item.Code = {
          ...item.Code,
          score, // Add score to the Code field
        };
      }
    }

    // Recursively check the Subs array for nested items (and nested Subs)
    if (item.Subs && item.Subs.length) {
      item.Subs.forEach(addScoreToItems); // Check sub-items and add score to them
    }
  };

  // Instead of accessing json.family, directly iterate over the root-level array
  json.forEach(addScoreToItems); // Apply fuzzySearch to each item directly

  // Return the modified json with scores
  return json; // Return the array of items with scores added
};

// Define the /fuzzy-search route
router.post("/fuzzy-search", (req, res) => {
  const { word, language, json } = req.body;

  if (!word || !language || !json) {
    return res
      .status(400)
      .json({ error: "word, language, and json fields are required." });
  }

  try {
    const results = fuzzySearch(word, language, json);
    res.json(results); // Return the modified json with scores added (no duplicates)
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Define the /best-matches route
router.post("/best-matches", (req, res) => {
  const { json } = req.body;

  if (!json) {
    return res
      .status(400)
      .json({ error: "json field is required." });
  }

  try {
    // 1. Collect all items (including nested Subs)
    const allItems = [];

    const collectItems = (item) => {
      // Add the item to the array
      allItems.push(item);

      // Recursively add items from Subs
      if (item.Subs && item.Subs.length) {
        item.Subs.forEach(collectItems); // Check sub-items as well
      }
    };

    // Start collecting items directly from the root-level array (not json.family)
    json.forEach(collectItems); 

    // 2. Get the best matches based on the highest score
    const bestMatches = getBestMatches(allItems, 3);
    res.json(bestMatches); // Return only the best matches
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
