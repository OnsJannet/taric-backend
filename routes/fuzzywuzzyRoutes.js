const fuzzball = require("fuzzball");
const express = require("express");
const router = express.Router();

// Normalize function to process strings
const normalizeString = (str) => {
  return str
    .toLowerCase()
    .replace(/[\r\n\t]/g, "")
    .replace(/\|%/g, "%")
    .replace(/[^a-z0-9\s%+\-\/|]/g, "")
    .trim();
};

// Recursive function to add scores to items, calculate scoresum, and add "enter" key to the highest scorer
const addScoreToItems = (item, normalizedWord, language) => {
  let scoresum = 0;
  let highestScore = 0; // Track the highest score in this layer
  let highestScoreItem = null; // Track the item with the highest score

  if (item.Code) {
    const descriptionField = language === "en" ? "FullDescriptionEN" : "FullDescription";
    const description = item.Code[descriptionField];

    if (description) {
      const normalizedDescription = normalizeString(description);
      const score = fuzzball.ratio(normalizedWord, normalizedDescription);

      // Add the score to the Code field
      item.Code = {
        ...item.Code,
        score,
      };

      scoresum += score;

      // Update the highest score and item
      if (score > highestScore) {
        highestScore = score;
        highestScoreItem = item;
      }
    }
  }

  // Recursively process Subs if present
  if (item.Subs && Array.isArray(item.Subs)) {
    item.Subs.forEach((subItem) => {
      const childScoresum = addScoreToItems(subItem, normalizedWord, language);
      scoresum += childScoresum;
    });
  }

  // After processing all children, assign the final score sum to the item
  item.scoresum = scoresum;

  // Add the "enter" key to the item with the highest score
  if (highestScoreItem) {
    highestScoreItem.enter = true;
  }

  return scoresum; // Return the scoresum for the parent to use
};

// Fuzzy search function
const fuzzySearch = (word, language, json) => {
  if (!word || !language || !json) {
    throw new Error("word, language, and json fields are required.");
  }

  const normalizedWord = normalizeString(word);

  // Ensure top-level JSON structure is an array
  if (!Array.isArray(json)) {
    throw new Error("Invalid JSON structure: Expected an array at the top level.");
  }

  // Apply fuzzy search to each top-level item
  json.forEach((item) => {
    // Check if `family` is an array
    if (Array.isArray(item.family)) {
      item.family.forEach((familyItem) =>
        addScoreToItems(familyItem, normalizedWord, language)
      );
    } else if (item.family && typeof item.family === "object") {
      // Handle case where `family` is an object
      addScoreToItems(item.family, normalizedWord, language);
    } else {
      addScoreToItems(item, normalizedWord, language);
    }
  });

  // Sort the items based on scoresum, in descending order
  const sortedJson = json.sort((a, b) => b.scoresum - a.scoresum);

  // If there are more than 3 items, only keep the top 3
  return sortedJson.slice(0, 3);
};

// Define the /fuzzy-search route
router.post("/fuzzy-search", (req, res) => {
  const { word, language, json } = req.body;

  if (!word || !language || !json) {
    return res.status(400).json({ error: "word, language, and json fields are required." });
  }

  try {
    const results = fuzzySearch(word, language, json);
    res.json(results);  // Send the final results back to the client
  } catch (error) {
    console.error("Error during fuzzy search:", error); // Log any error
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
