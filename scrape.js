const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const url = require('url');

async function scrapePage(pageUrl) {
  try {
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);

    // Example: Extracting items from a table
    const data = [];
    $('table#dataTable tr').each((i, row) => {
      if (i === 0) return; // Skip header row
      const cols = $(row).find('td');
      const item = {
        Column1: $(cols[0]).text().trim(),
        Column2: $(cols[1]).text().trim(),
        // Add more columns as needed
      };
      data.push(item);
    });

    return data;
  } catch (error) {
    console.error(`Error scraping page ${pageUrl}:`, error.message);
    return [];
  }
}

async function main() {
  let currentPage = 'https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=en&SimDate=20240814&Area=&MeasType=&StartPub=&EndPub=&MeasText=&GoodsText=&op=&Taric=&AdditionalCode=&search_text=goods&textSearch=&LangDescr=en&OrderNum=&Regulation=&measStartDat=&measEndDat=&DatePicker=14-08-2024';
  const allData = [];

  while (currentPage) {
    console.log(`Scraping page: ${currentPage}`);
    const pageData = await scrapePage(currentPage);
    if (pageData.length === 0) break;
    allData.push(...pageData);

    // Find and update the URL for the next page
    const response = await axios.get(currentPage);
    const $ = cheerio.load(response.data);
    const nextButton = $('a#nextPage'); // Adjust according to the actual button ID or class

    if (nextButton.length > 0) {
      currentPage = url.resolve(currentPage, nextButton.attr('href'));
    } else {
      currentPage = null;
    }
  }

  // Save data to JSON file
  fs.writeFileSync('scraped_data.json', JSON.stringify(allData, null, 2));
  console.log('Scraping complete. Data saved to scraped_data.json.');
}

main().catch(err => console.error(err));
