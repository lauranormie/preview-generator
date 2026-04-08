const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
        ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1440, height: 900 });

    const url = 'https://app.supernormal.com/share/34ab5788-d7d9-43a7-9a12-5b965cc499c2/embed';

    console.log('Loading:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('button[type="button"]', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take full page screenshot
    await page.screenshot({ path: '/Users/laurajames/Desktop/debug-full-page.png' });
    console.log('Full page screenshot saved to ~/Desktop/debug-full-page.png');

    // Also try the crop area
    const SLIDE_CROP = { x: 336, y: 24, width: 895, height: 506 };
    await page.screenshot({
        path: '/Users/laurajames/Desktop/debug-crop.png',
        clip: SLIDE_CROP
    });
    console.log('Crop screenshot saved to ~/Desktop/debug-crop.png');

    await browser.close();
})();
