const puppeteer = require('puppeteer');
const fs = require('fs');

// Function to scrape data for a specific language
async function scrapePage(page, pageNumber, lang) {
    // Calculate the offset for pagination
    const offset = (pageNumber - 1) * 25;
    const url = `https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=${lang}&SimDate=20240815&Area=&MeasType=&StartPub=&EndPub=&MeasText=&GoodsText=&op=&Taric=&AdditionalCode=&search_text=goods&textSearch=&LangDescr=${lang}&OrderNum=&Regulation=&measStartDat=&measEndDat=&DatePicker=15-08-2024&ShowMatchingGoods=&Domain=TARIC&ExpandAll=&DomainNameLink=measures.jsp&search_text=goods&Offset=${offset}`;

    await page.goto(url, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(() => {
        let items = [];

        document.querySelectorAll('[class^="nomenclaturecode"]').forEach((element) => {
            let code = element.querySelector('.tdlabel')?.innerText.trim();
            let description = element.querySelector('.to_highlight')?.innerText.trim();
            let footnotes = element.querySelector('span.footnote_parenthesis')?.innerHTML || '';

            if (footnotes) {
                description += ` ${footnotes}`;
            }

            if (code && description) {
                items.push({ code, description });
            }
        });

        return items;
    });

    return results;
}

async function scrapeAllPagesForLanguage(lang, fileName) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let allResults = [];

    for (let i = 1; i <= 220; i++) {
        console.log(`Scraping ${lang} page ${i}...`);
        const pageResults = await scrapePage(page, i, lang);
        allResults = allResults.concat(pageResults);
    }

    await browser.close();

    // Save results to a JSON file
    fs.writeFileSync(fileName, JSON.stringify(allResults, null, 2));
    console.log(`Scraping completed for ${lang} and data saved to ${fileName}`);
}

// Execute the scraping functions for both languages
(async () => {
    await scrapeAllPagesForLanguage('en', 'scraped_data_en.json');
    await scrapeAllPagesForLanguage('it', 'scraped_data_it.json');
})();
