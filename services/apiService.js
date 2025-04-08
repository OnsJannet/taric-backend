const axios = require('axios');
const MemoryCache = require('../utils/cacheUtil');

// Create a cache instance with 2-hour TTL
const apiCache = new MemoryCache(2 * 60 * 60 * 1000);

/**
 * Fetches data from an external API with caching
 * @param {string} url - The API URL
 * @param {Object} options - Axios request options
 * @param {number} cacheTtl - Cache TTL in milliseconds (optional)
 * @returns {Promise<Object>} - The API response data
 */
const fetchWithCache = async (url, options = {}, cacheTtl = null) => {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  
  // Check if we have a cached response
  const cachedData = apiCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  try {
    const response = await axios({
      url,
      ...options,
      headers: {
        'Cache-Control': 'no-cache',
        ...options.headers
      }
    });
    
    // Cache the response
    apiCache.set(cacheKey, response.data, cacheTtl);
    
    return response.data;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error.message);
    throw error;
  }
};

/**
 * Fetches JSON data from a GitHub raw content URL with caching
 * @param {string} repo - The GitHub repository
 * @param {string} branch - The branch name
 * @param {string} path - The file path
 * @returns {Promise<Object>} - The parsed JSON data
 */
const fetchGithubJson = async (repo, branch, path) => {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  return fetchWithCache(url);
};

module.exports = {
  fetchWithCache,
  fetchGithubJson
};
