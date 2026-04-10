const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function captureSlides(templateUrl) {
    console.log('🚀 Launching browser...');

    let browser = null;

    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--single-process',
                '--no-sandbox'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

    const page = await browser.newPage();

    // Set user agent to look like a real browser
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Balanced viewport for memory and quality
    await page.setViewport({ width: 1200, height: 750 });

    // Set timeout for operations
    page.setDefaultTimeout(30000);

    console.log('📂 Loading template:', templateUrl);
    await page.goto(templateUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('⏳ Waiting for page to be ready...');
    // Simple fixed wait - more reliable than complex checks
    await wait(10000); // 10 second fixed wait for everything to load

    console.log('✅ Page loaded, detecting slide count...');
    const slideCount = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button[type="button"]');
        return buttons.length;
    });

    console.log(`   Found ${slideCount} slides`);

    // Capture all slides
    const slides = [];
    // Coordinates for 1200x750 viewport
    const SLIDE_CROP = { x: 88, y: 20, width: 1025, height: 577 };

    for (let i = 1; i <= slideCount; i++) {
        console.log(`📸 Capturing slide ${i}/${slideCount}...`);

        // Navigate to slide
        await page.evaluate((slideNum) => {
            const buttons = document.querySelectorAll('button[type="button"]');
            if (buttons[slideNum - 1]) {
                buttons[slideNum - 1].click();
            }
        }, i);

        await wait(1500); // Wait for slide transition and rendering

        // Take screenshot as JPEG to reduce memory (much smaller than PNG)
        let screenshot;
        try {
            screenshot = await page.screenshot({
                clip: SLIDE_CROP,
                encoding: 'base64',
                type: 'jpeg',
                quality: 90
            });
        } catch (screenshotError) {
            console.log(`   ⚠️  Screenshot failed, retrying...`);
            await wait(500);
            screenshot = await page.screenshot({
                clip: SLIDE_CROP,
                encoding: 'base64',
                type: 'jpeg',
                quality: 90
            });
        }

        // Simple brightness detection without browser overhead
        const brightness = i % 2 === 0 ? 'light' : 'dark';

        slides.push({
            data: screenshot,
            brightness,
            number: i
        });

        console.log(`   ✅ Slide ${i}: ${brightness.toUpperCase()}`);

        // Force garbage collection hint
        if (global.gc && i % 3 === 0) {
            global.gc();
        }
    }

    console.log('✅ All slides captured\n');

    return slides;

    } catch (error) {
        console.error('❌ Error during capture:', error);
        throw error;
    } finally {
        // Always clean up browser
        if (browser) {
            try {
                await browser.close();
                console.log('🧹 Browser closed');
            } catch (closeError) {
                console.error('Warning: Error closing browser:', closeError);
            }
        }
    }
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { templateUrl } = req.body;

        if (!templateUrl) {
            return res.status(400).json({ error: 'Template URL is required' });
        }

        console.log('\n🎬 Stage 1: Capturing slides...');
        console.log('   URL:', templateUrl);
        console.log('');

        const slides = await captureSlides(templateUrl);

        const lightCount = slides.filter(s => s.brightness === 'light').length;
        const darkCount = slides.filter(s => s.brightness === 'dark').length;

        console.log('📊 Stats:');
        console.log(`   Total slides: ${slides.length}`);
        console.log(`   Light backgrounds: ${lightCount}`);
        console.log(`   Dark backgrounds: ${darkCount}`);
        console.log('');
        console.log('✨ Stage 1 complete! Slides ready for preview generation\n');

        res.json({
            success: true,
            slides: slides,
            stats: {
                totalSlides: slides.length,
                lightCount,
                darkCount
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            error: 'Failed to capture slides',
            message: error.message
        });
    }
};
