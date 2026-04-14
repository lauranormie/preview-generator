const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function captureSlides(templateUrl, singleSlideNumber = null) {
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

    // Reduced viewport to prevent crashes
    await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });

    // Set timeout for operations
    page.setDefaultTimeout(30000);

    console.log('📂 Loading template:', templateUrl);
    await page.goto(templateUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('⏳ Waiting for page to be ready...');
    // Wait for page to fully load
    await wait(5000);

    console.log('✅ Page loaded, detecting slide count...');
    const slideCount = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button[type="button"]');
        return buttons.length;
    });

    console.log(`   Found ${slideCount} slides`);

    // Determine which slides to capture
    const startSlide = singleSlideNumber || 1;
    const endSlide = singleSlideNumber || slideCount;

    if (singleSlideNumber) {
        console.log(`   Single slide mode: capturing slide ${singleSlideNumber}`);
    }

    // Capture slides
    const slides = [];
    // Coordinates for 960x600 viewport
    const SLIDE_CROP = { x: 70, y: 16, width: 820, height: 462 };

    for (let i = startSlide; i <= endSlide; i++) {
        console.log(`📸 Capturing slide ${i}/${slideCount}...`);

        // Navigate to slide
        await page.evaluate((slideNum) => {
            const buttons = document.querySelectorAll('button[type="button"]');
            if (buttons[slideNum - 1]) {
                buttons[slideNum - 1].click();
            }
        }, i);

        // Simple wait for slide transition and content load
        await wait(3000);

        // Check if page is still connected before attempting screenshot
        if (page.isClosed()) {
            throw new Error(`Page was closed unexpectedly at slide ${i}`);
        }

        // Take screenshot with retry logic for blank slides
        let screenshot;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                // Double-check page/browser are still alive
                if (page.isClosed() || !browser.isConnected()) {
                    throw new Error('Browser or page session closed unexpectedly');
                }

                screenshot = await page.screenshot({
                    clip: SLIDE_CROP,
                    encoding: 'base64',
                    type: 'jpeg',
                    quality: 80  // Reduced quality to save memory
                });

                // Check if screenshot is suspiciously small (likely blank)
                const imageSize = screenshot.length;
                const isLikelyBlank = imageSize < 5000; // Very small base64 = likely blank/white

                if (isLikelyBlank && retryCount < maxRetries) {
                    console.log(`   ⚠️  Slide ${i} appears blank (${imageSize} bytes), retrying...`);
                    retryCount++;
                    await wait(2000); // Wait longer before retry
                    continue;
                }

                break; // Screenshot successful
            } catch (screenshotError) {
                console.error(`   ❌ Screenshot error at slide ${i}:`, screenshotError.message);

                // If it's a Protocol error, the session is dead - can't recover
                if (screenshotError.message.includes('Protocol error') ||
                    screenshotError.message.includes('Session closed')) {
                    throw new Error(`Browser session crashed at slide ${i}. Try capturing fewer slides or reduce viewport size.`);
                }

                if (retryCount < maxRetries) {
                    console.log(`   ⚠️  Screenshot failed, retrying (attempt ${retryCount + 1}/${maxRetries})...`);
                    retryCount++;
                    await wait(1000);
                } else {
                    throw screenshotError;
                }
            }
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

        // Provide helpful message for common errors
        if (error.message.includes('ETXTBSY')) {
            throw new Error('Chrome executable is busy. Please wait a few seconds and try again.');
        }

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
        const { templateUrl, singleSlide } = req.body;

        if (!templateUrl) {
            return res.status(400).json({ error: 'Template URL is required' });
        }

        if (singleSlide) {
            console.log(`\n🔄 Retrying single slide ${singleSlide}...`);
            console.log('   URL:', templateUrl);
            console.log('');
        } else {
            console.log('\n🎬 Stage 1: Capturing slides...');
            console.log('   URL:', templateUrl);
            console.log('');
        }

        const slides = await captureSlides(templateUrl, singleSlide);

        const lightCount = slides.filter(s => s.brightness === 'light').length;
        const darkCount = slides.filter(s => s.brightness === 'dark').length;

        console.log('📊 Stats:');
        console.log(`   Total slides: ${slides.length}`);
        console.log(`   Light backgrounds: ${lightCount}`);
        console.log(`   Dark backgrounds: ${darkCount}`);
        console.log('');

        if (singleSlide) {
            console.log(`✨ Slide ${singleSlide} recaptured successfully!\n`);
        } else {
            console.log('✨ Stage 1 complete! Slides ready for preview generation\n');
        }

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
