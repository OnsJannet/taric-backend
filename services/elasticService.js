const stripHtmlTags = (text) => text.replace(/<\/?[^>]+>/gi, '').trim();

const extractTextBeforeTag = (text) => {
  const regex = /(.*?)(?:\s*<a\s+class="ecl-link.*?>.*<\/a>)$/i;
  const match = text.match(regex);
  return match ? match[1].trim() : text;
};

/**
 * Performs a search on the provided data using the given search term
 * @param {Array} data - The dataset to search through
 * @param {string} term - The search term
 * @returns {Array} - The search results
 */
const search = (data, term) => {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid data provided for search');
  }
  
  if (!term || typeof term !== 'string') {
    throw new Error('Invalid search term provided');
  }

  // Clean and normalize term
  const cleanedTerm = term.toLowerCase().trim();
  
  // Split the cleaned term into individual words
  const termsArray = cleanedTerm.split(/\s+/);
  
  const resultsMap = {};

  // Search for each term separately
  termsArray.forEach(word => {
    data.forEach(item => {
      let cleanedDescription = stripHtmlTags(item.description).toLowerCase().trim();
      cleanedDescription = extractTextBeforeTag(cleanedDescription);

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

  return results;
};

module.exports = {
  search,
  stripHtmlTags,
  extractTextBeforeTag
};
