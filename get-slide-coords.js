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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('button[type="button"]', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the bounding box of the slide preview area
    const slideBox = await page.evaluate(() => {
        // Try to find the slide preview container
        const slidePreview = document.querySelector('[aria-label="Slide Preview"]') ||
                            document.querySelector('main > div:last-child') ||
                            document.querySelector('main');

        if (slidePreview) {
            const rect = slidePreview.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom)
            };
        }
        return null;
    });

    console.log('Slide preview coordinates:', JSON.stringify(slideBox, null, 2));

    // Also check all main children
    const allElements = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return [];

        return Array.from(main.children).map((el, i) => {
            const rect = el.getBoundingClientRect();
            return {
                index: i,
                tag: el.tagName,
                classes: el.className,
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
        });
    });

    console.log('\nMain children:', JSON.stringify(allElements, null, 2));

    await browser.close();
})();
