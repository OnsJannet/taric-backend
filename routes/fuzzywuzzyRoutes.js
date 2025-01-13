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

// Recursive function to add scores to items
const addScoreToItems = (item, normalizedWord, language) => {
  if (item.Code) {
    const descriptionField = language === "en" ? "FullDescriptionEN" : "FullDescription";
    const description = item.Code[descriptionField];

    if (description) {
      const normalizedDescription = normalizeString(description);
      const score = fuzzball.ratio(normalizedWord, normalizedDescription);

      item.Code = {
        ...item.Code,
        score,
      };
    }
  }

  if (item.Subs && Array.isArray(item.Subs)) {
    item.Subs.forEach((subItem) => addScoreToItems(subItem, normalizedWord, language));
  }
};

// Fuzzy search function
const fuzzySearch = (word, language, json) => {
  if (!word || !language || !json) {
    throw new Error("word, language, and json fields are required.");
  }

  const normalizedWord = normalizeString(word);

  if (!Array.isArray(json)) {
    throw new Error("Invalid JSON structure: Expected an array at the top level.");
  }

  json.forEach((item) => {
    if (Array.isArray(item.family)) {
      item.family.forEach((familyItem) =>
        addScoreToItems(familyItem, normalizedWord, language)
      );
    } else if (item.family && typeof item.family === "object") {
      addScoreToItems(item.family, normalizedWord, language);
    } else {
      addScoreToItems(item, normalizedWord, language);
    }
  });

  return JSON.parse(JSON.stringify(json)); // Ensure no serialization issues
};

router.post("/fuzzy-search", (req, res) => {
  const { word, language, json } = req.body;

  if (!word || !language || !json) {
    return res.status(400).json({ error: "word, language, and json fields are required." });
  }

  try {
    const results = fuzzySearch(word, language, json);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
