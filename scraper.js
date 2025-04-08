const scraperService = require('./services/scraperService');
const { ApiError } = require('./middlewares/errorMiddleware');
require('dotenv').config();

/**
 * Main function to execute the scraping process
 */
const runScraper = async () => {
  try {
    console.log('Starting scraping process...');
    const startTime = Date.now();
    
    // Add memory usage monitoring
    const initialMemoryUsage = process.memoryUsage();
    console.log('Initial memory usage:', formatMemoryUsage(initialMemoryUsage));
    
    // Run the scraper with progress reporting
    const result = await scraperService.scrapeAllLanguages();
    
    // Log completion statistics
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const finalMemoryUsage = process.memoryUsage();
    
    console.log(`Scraping completed in ${duration.toFixed(2)} seconds`);
    console.log('Final memory usage:', formatMemoryUsage(finalMemoryUsage));
    console.log('Memory difference:', formatMemoryUsageDifference(initialMemoryUsage, finalMemoryUsage));
    
    console.log(`Total items scraped: EN=${result.en.length}, IT=${result.it.length}`);
    
    return result;
  } catch (error) {
    console.error('Error in scraping process:', error);
    if (error instanceof ApiError) {
      console.error(`API Error (${error.statusCode}): ${error.message}`);
    }
    process.exit(1);
  }
};

/**
 * Format memory usage for logging
 * @param {Object} memoryUsage - Memory usage object from process.memoryUsage()
 * @returns {Object} - Formatted memory usage
 */
const formatMemoryUsage = (memoryUsage) => {
  return {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
  };
};

/**
 * Calculate memory usage difference
 * @param {Object} start - Initial memory usage
 * @param {Object} end - Final memory usage
 * @returns {Object} - Memory usage difference
 */
const formatMemoryUsageDifference = (start, end) => {
  return {
    rss: `${Math.round((end.rss - start.rss) / 1024 / 1024)} MB`,
    heapTotal: `${Math.round((end.heapTotal - start.heapTotal) / 1024 / 1024)} MB`,
    heapUsed: `${Math.round((end.heapUsed - start.heapUsed) / 1024 / 1024)} MB`,
    external: `${Math.round((end.external - start.external) / 1024 / 1024)} MB`
  };
};

// Execute the scraper if this file is run directly
if (require.main === module) {
  runScraper();
}

module.exports = { runScraper };
