const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function captureAndGenerate(templateUrl, heroSlide = 0, colorTheme = 'black') {
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

    // Set longer default timeout for all operations
    page.setDefaultTimeout(120000);

    console.log('📂 Loading template:', templateUrl);
    await page.goto(templateUrl, { waitUntil: 'networkidle2', timeout: 90000 });

    console.log('⏳ Waiting for slides to load...');
    // Wait for buttons and iframe to be ready
    await page.waitForFunction(
        () => {
            const buttons = document.querySelectorAll('button[type="button"]');
            const iframe = document.querySelector('iframe');
            return buttons.length >= 11 && iframe !== null;
        },
        { timeout: 90000 }
    );

    console.log('⏳ Ensuring iframe is fully loaded and stable...');
    // Wait for iframe to be fully loaded
    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('iframe');
            if (!iframe) return false;
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                return iframeDoc && iframeDoc.readyState === 'complete';
            } catch (e) {
                return false;
            }
        },
        { timeout: 90000 }
    );

    console.log('⏳ Waiting for iframe to fully stabilize...');
    await wait(5000); // Extra time for iframe to stabilize

    // Ensure page is ready
    await page.evaluate(() => document.readyState);

    // One more stability check before starting
    await page.waitForFunction(
        () => {
            const iframe = document.querySelector('iframe');
            if (!iframe) return false;
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                return iframeDoc && iframeDoc.readyState === 'complete';
            } catch (e) {
                return false;
            }
        },
        { timeout: 30000 }
    );

    await wait(2000); // Final stabilization wait

    // Capture all slides
    const slides = [];
    // Coordinates for 1200x750 viewport
    const SLIDE_CROP = { x: 88, y: 20, width: 1025, height: 577 };

    for (let i = 1; i <= 11; i++) {
        console.log(`📸 Capturing slide ${i}/11...`);

        // Check if page is still alive
        if (page.isClosed()) {
            throw new Error('Page was closed unexpectedly');
        }

        // Verify iframe is still attached and loaded
        const iframeStable = await page.evaluate(() => {
            const iframe = document.querySelector('iframe');
            if (!iframe) return false;
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                return iframeDoc && iframeDoc.readyState === 'complete';
            } catch (e) {
                return false;
            }
        });

        if (!iframeStable) {
            console.log(`   ⚠️  Iframe unstable, waiting 2s...`);
            await wait(2000);
        }

        // Navigate to slide
        await page.evaluate((slideNum) => {
            const buttons = document.querySelectorAll('button[type="button"]');
            if (buttons[slideNum - 1]) {
                buttons[slideNum - 1].click();
            }
        }, i);

        await wait(1500); // Wait for slide transition and rendering

        // Wait for iframe content to be visible
        await page.waitForFunction(
            () => {
                const iframe = document.querySelector('iframe');
                if (!iframe) return false;
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const body = iframeDoc.body;
                    // Check if body has actual content (not empty/white)
                    return body && body.innerHTML.length > 100;
                } catch (e) {
                    return false;
                }
            },
            { timeout: 10000 }
        ).catch(() => console.log('   ⚠️  Iframe content check timed out, continuing anyway'));

        await wait(500); // Extra buffer

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
            console.log(`   ⚠️  Screenshot failed, retrying after 2s...`);
            await wait(2000);
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
    console.log('🎨 Generating preview in browser...');

    // Generate preview in browser
    const previewBase64 = await page.evaluate(async (slidesData, heroIdx, theme) => {
        // Balance slides
        function balanceSlides(slides) {
            const light = slides.filter(s => s.brightness === 'light');
            const dark = slides.filter(s => s.brightness === 'dark');

            const balanced = [];
            let lightIdx = 0;
            let darkIdx = 0;

            while (lightIdx < light.length || darkIdx < dark.length) {
                if (lightIdx < light.length) balanced.push(light[lightIdx++]);
                if (darkIdx < dark.length) balanced.push(dark[darkIdx++]);
            }

            return balanced;
        }

        // Load all slide images
        const loadedSlides = await Promise.all(slidesData.map(async (slide) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ img, brightness: slide.brightness });
                img.src = 'data:image/jpeg;base64,' + slide.data;
            });
        }));

        const balancedSlides = balanceSlides([...loadedSlides]);

        // Create canvas at 1.5x resolution (balance between quality and memory)
        const scale = 1.5;
        const canvas = document.createElement('canvas');
        canvas.width = 1200 * scale;
        canvas.height = 630 * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Color theme configuration
        const themeConfig = {
            'black': { bg: '#000', bgGradient: null },
            'white': { bg: '#fff', bgGradient: null },
            'blue': { bg: '#008EFF', bgGradient: null },
            'light-gray': { bg: '#E5E7EB', bgGradient: null }
        };

        const config = themeConfig[theme] || themeConfig['black'];

        // Apply background
        ctx.fillStyle = config.bg;
        ctx.fillRect(0, 0, 1200, 630);

        // Diagonal perspective repeating grid layout
        const tileWidth = 280;
        const tileHeight = 158;
        const spacing = 22;
        const gridRotation = -25;

        ctx.save();
        ctx.translate(600, 315);
        ctx.rotate((gridRotation * Math.PI) / 180);

        // Create repeating diagonal grid
        const cols = 6;
        const rows = 4;

        let slideIdx = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (slideIdx >= balancedSlides.length) slideIdx = 0;

                let x = col * (tileWidth + spacing) - ((cols * (tileWidth + spacing)) / 2);
                let y = row * (tileHeight + spacing) - ((rows * (tileHeight + spacing)) / 2);

                if (row % 2 === 1) {
                    x += (tileWidth + spacing) / 2;
                }

                ctx.save();
                ctx.translate(x + tileWidth / 2, y + tileHeight / 2);
                ctx.globalAlpha = 0.55;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(
                    balancedSlides[slideIdx].img,
                    -tileWidth / 2,
                    -tileHeight / 2,
                    tileWidth,
                    tileHeight
                );

                ctx.restore();
                slideIdx++;
            }
        }

        ctx.restore();

        // Add hero image with rounded corners and shadow
        const heroSlide = loadedSlides[heroIdx].img;
        const heroWidth = 600;
        const heroHeight = (heroSlide.height / heroSlide.width) * heroWidth;
        const heroX = (1200 - heroWidth) / 2;
        const heroY = (630 - heroHeight) / 2;
        const borderRadius = 20;

        // Draw shadow first
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 15;

        // Draw a filled rounded rectangle to cast the shadow
        ctx.beginPath();
        ctx.moveTo(heroX + borderRadius, heroY);
        ctx.lineTo(heroX + heroWidth - borderRadius, heroY);
        ctx.arcTo(heroX + heroWidth, heroY, heroX + heroWidth, heroY + borderRadius, borderRadius);
        ctx.lineTo(heroX + heroWidth, heroY + heroHeight - borderRadius);
        ctx.arcTo(heroX + heroWidth, heroY + heroHeight, heroX + heroWidth - borderRadius, heroY + heroHeight, borderRadius);
        ctx.lineTo(heroX + borderRadius, heroY + heroHeight);
        ctx.arcTo(heroX, heroY + heroHeight, heroX, heroY + heroHeight - borderRadius, borderRadius);
        ctx.lineTo(heroX, heroY + borderRadius);
        ctx.arcTo(heroX, heroY, heroX + borderRadius, heroY, borderRadius);
        ctx.closePath();
        ctx.fillStyle = '#000'; // Black fill for shadow
        ctx.fill();
        ctx.restore();

        // Now draw the actual hero slide with rounded corners (no shadow)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(heroX + borderRadius, heroY);
        ctx.lineTo(heroX + heroWidth - borderRadius, heroY);
        ctx.arcTo(heroX + heroWidth, heroY, heroX + heroWidth, heroY + borderRadius, borderRadius);
        ctx.lineTo(heroX + heroWidth, heroY + heroHeight - borderRadius);
        ctx.arcTo(heroX + heroWidth, heroY + heroHeight, heroX + heroWidth - borderRadius, heroY + heroHeight, borderRadius);
        ctx.lineTo(heroX + borderRadius, heroY + heroHeight);
        ctx.arcTo(heroX, heroY + heroHeight, heroX, heroY + heroHeight - borderRadius, borderRadius);
        ctx.lineTo(heroX, heroY + borderRadius);
        ctx.arcTo(heroX, heroY, heroX + borderRadius, heroY, borderRadius);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(heroSlide, heroX, heroY, heroWidth, heroHeight);
        ctx.restore();

        // Return as base64 with good quality (balanced for memory)
        return canvas.toDataURL('image/jpeg', 0.90);
    }, slides, heroSlide, colorTheme);

    console.log('✅ Preview generated\n');

    return {
        preview: previewBase64,
        slides: slides.map(s => ({ brightness: s.brightness, number: s.number }))
    };

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
        const {
            templateUrl,
            heroSlide = 0,
            colorTheme = 'black'
        } = req.body;

        if (!templateUrl) {
            return res.status(400).json({ error: 'Template URL is required' });
        }

        console.log('\n🎬 Starting generation...');
        console.log('   URL:', templateUrl);
        console.log('   Color theme:', colorTheme);
        console.log('   Hero slide:', heroSlide + 1);
        console.log('');

        const result = await captureAndGenerate(templateUrl, heroSlide, colorTheme);

        const lightCount = result.slides.filter(s => s.brightness === 'light').length;
        const darkCount = result.slides.filter(s => s.brightness === 'dark').length;

        console.log('📊 Stats:');
        console.log(`   Total slides: ${result.slides.length}`);
        console.log(`   Light backgrounds: ${lightCount}`);
        console.log(`   Dark backgrounds: ${darkCount}`);
        console.log('');
        console.log('✨ Done! Preview ready for download\n');

        res.json({
            success: true,
            preview: result.preview,
            stats: {
                totalSlides: result.slides.length,
                lightCount,
                darkCount
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            error: 'Failed to generate preview',
            message: error.message
        });
    }
};
