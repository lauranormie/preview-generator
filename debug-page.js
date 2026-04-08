const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,  // Show browser
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const url = 'https://app.supernormal.com/share/34ab5788-d7d9-43a7-9a12-5b965cc499c2/embed';

    console.log('Loading:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Page loaded, waiting 5 seconds...');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: '/Users/laurajames/Desktop/debug-page.png', fullPage: true });
    console.log('Screenshot saved to ~/Desktop/debug-page.png');

    // Get page HTML
    const html = await page.content();
    console.log('\n=== PAGE HTML (first 1000 chars) ===');
    console.log(html.substring(0, 1000));

    // Check what elements exist
    const buttons = await page.$$('button');
    console.log(`\nFound ${buttons.length} button elements`);

    const main = await page.$('main');
    console.log(`Main element exists: ${main !== null}`);

    // Get all elements
    const allElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        return Array.from(elements).slice(0, 20).map(el => ({
            tag: el.tagName,
            id: el.id,
            classes: el.className
        }));
    });

    console.log('\n=== First 20 elements ===');
    console.log(JSON.stringify(allElements, null, 2));

    console.log('\nPress Ctrl+C to close browser...');
    // Keep browser open for inspection
    await new Promise(() => {});
})();
