const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const MemoryCache = require('../utils/cacheUtil');

// Create a cache for scraped data
const scraperCache = new MemoryCache(24 * 60 * 60 * 1000); // 24 hour TTL

/**
 * Scrapes a single page for a specific language
 * @param {Object} page - Puppeteer page object
 * @param {number} pageNumber - Page number to scrape
 * @param {string} lang - Language code ('en' or 'it')
 * @returns {Promise<Array>} - Array of scraped items
 */
const scrapePage = async (page, pageNumber, lang) => {
  // Calculate the offset for pagination
  const offset = (pageNumber - 1) * 25;
  const url = `https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=${lang}&SimDate=20240815&Area=&MeasType=&StartPub=&EndPub=&MeasText=&GoodsText=&op=&Taric=&AdditionalCode=&search_text=goods&textSearch=&LangDescr=${lang}&OrderNum=&Regulation=&measStartDat=&measEndDat=&DatePicker=15-08-2024&ShowMatchingGoods=&Domain=TARIC&ExpandAll=&DomainNameLink=measures.jsp&search_text=goods&Offset=${offset}`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    return await page.evaluate(() => {
      const items = [];

      document.querySelectorAll('[class^="nomenclaturecode"]').forEach((element) => {
        const code = element.querySelector('.tdlabel')?.innerText.trim();
        let description = element.querySelector('.to_highlight')?.innerText.trim();
        const footnotes = element.querySelector('span.footnote_parenthesis')?.innerHTML || '';

        if (footnotes) {
          description += ` ${footnotes}`;
        }

        if (code && description) {
          items.push({ code, description });
        }
      });

      return items;
    });
  } catch (error) {
    console.error(`Error scraping page ${pageNumber} for language ${lang}:`, error);
    return []; // Return empty array on error to continue with other pages
  }
};

/**
 * Scrapes all pages for a specific language
 * @param {string} lang - Language code ('en' or 'it')
 * @param {string} fileName - Output file name
 * @returns {Promise<Array>} - Array of all scraped items
 */
const scrapeAllPagesForLanguage = async (lang, fileName) => {
  // Check cache first
  const cacheKey = `scrape-${lang}`;
  const cachedResults = scraperCache.get(cacheKey);
  
  if (cachedResults) {
    console.log(`Using cached results for ${lang}`);
    return cachedResults;
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    let allResults = [];
    
    // Set a reasonable timeout
    await page.setDefaultNavigationTimeout(60000);
    
    // Configure the page for better performance
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Skip images, fonts, and other non-essential resources
      const resourceType = request.resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Scrape pages in batches to avoid memory issues
    const totalPages = 220;
    const batchSize = 10;
    
    for (let batchStart = 1; batchStart <= totalPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, totalPages);
      console.log(`Scraping ${lang} pages ${batchStart} to ${batchEnd}...`);
      
      // Create an array of promises for the batch
      const batchPromises = [];
      for (let i = batchStart; i <= batchEnd; i++) {
        batchPromises.push(scrapePage(page, i, lang));
      }
      
      // Execute the batch and collect results
      const batchResults = await Promise.all(batchPromises);
      allResults = allResults.concat(batchResults.flat());
      
      // Add a small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save results to a JSON file
    await fs.writeFile(fileName, JSON.stringify(allResults, null, 2));
    console.log(`Scraping completed for ${lang} and data saved to ${fileName}`);
    
    // Cache the results
    scraperCache.set(cacheKey, allResults);
    
    return allResults;
  } catch (error) {
    console.error(`Error scraping data for ${lang}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
};

/**
 * Scrapes data for both languages
 * @returns {Promise<Object>} - Object containing scraped data for both languages
 */
const scrapeAllLanguages = async () => {
  try {
    const [enData, itData] = await Promise.all([
      scrapeAllPagesForLanguage('en', 'scraped_data_en.json'),
      scrapeAllPagesForLanguage('it', 'scraped_data_it.json')
    ]);
    
    return {
      en: enData,
      it: itData
    };
  } catch (error) {
    console.error('Error scraping all languages:', error);
    throw error;
  }
};

module.exports = {
  scrapePage,
  scrapeAllPagesForLanguage,
  scrapeAllLanguages
};
