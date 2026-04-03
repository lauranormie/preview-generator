const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

// Helper function to wait (replaces deprecated page.waitForTimeout)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function captureAndGenerate(templateUrl, heroSlide = 0) {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',  // Hide automation
            '--disable-dev-shm-usage',
        ]
    });

    const page = await browser.newPage();

    // Set user agent to look like a real browser
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setViewport({ width: 1440, height: 900 });

    console.log('📂 Loading template:', templateUrl);
    await page.goto(templateUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('⏳ Waiting for React app to render...');
    // Wait for the loading spinner to disappear and content to appear
    await page.waitForFunction(
        () => !document.querySelector('.lucide-loader-circle') && document.querySelectorAll('button').length > 0,
        { timeout: 30000 }
    );

    await wait(5000); // Extra time for all slides to fully load

    // Capture all slides
    const slides = [];
    // Coordinates for 1440x900 viewport - measured from iframe element
    // Main slide iframe: x:105, y:24, width:1230, height:692
    const SLIDE_CROP = { x: 105, y: 24, width: 1230, height: 692 };

    for (let i = 1; i <= 11; i++) {
        console.log(`📸 Capturing slide ${i}/11...`);

        // Navigate to slide
        await page.evaluate((slideNum) => {
            const buttons = document.querySelectorAll('button[type="button"]');
            if (buttons[slideNum - 1]) {
                buttons[slideNum - 1].click();
            }
        }, i);

        await wait(1000); // Increased wait time for slide to fully render

        // Take screenshot
        const screenshot = await page.screenshot({
            clip: SLIDE_CROP,
            encoding: 'base64'
        });

        // Analyze brightness
        const brightness = await page.evaluate((imgData) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 50;
                    canvas.height = 50;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 50, 50);

                    const imageData = ctx.getImageData(0, 0, 50, 50);
                    const data = imageData.data;
                    let totalBrightness = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
                        totalBrightness += brightness;
                    }

                    const avgBrightness = totalBrightness / (50 * 50);
                    resolve(avgBrightness > 128 ? 'light' : 'dark');
                };
                img.src = 'data:image/png;base64,' + imgData;
            });
        }, screenshot);

        slides.push({
            data: screenshot,
            brightness,
            number: i
        });

        console.log(`   ✅ Slide ${i}: ${brightness.toUpperCase()}`);
    }

    console.log('✅ All slides captured\n');
    console.log('🎨 Generating preview in browser...');

    // Generate preview in browser
    const previewBase64 = await page.evaluate(async (slidesData, heroIdx) => {
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
                img.src = 'data:image/png;base64,' + slide.data;
            });
        }));

        const balancedSlides = balanceSlides([...loadedSlides]);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');

        // Black background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 1200, 630);

        // Isometric stack settings
        const tileWidth = 180;
        const tileHeight = 101;
        const spacing = 15;
        const rotation = -15;

        ctx.save();
        ctx.translate(600, 315);
        ctx.rotate((rotation * Math.PI) / 180);

        // Create isometric stack
        const cols = Math.ceil((1200 * 1.5) / (tileWidth + spacing));
        const rows = Math.ceil((630 * 1.5) / (tileHeight + spacing));

        let slideIdx = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (slideIdx >= balancedSlides.length) slideIdx = 0;

                let x = col * (tileWidth + spacing) - (1200 * 0.75);
                const y = row * (tileHeight + spacing) - (630 * 0.75);

                if (row % 2 === 1) {
                    x += tileWidth / 2;
                }

                ctx.drawImage(balancedSlides[slideIdx].img, x, y, tileWidth, tileHeight);
                slideIdx++;
            }
        }

        ctx.restore();

        // Apply gradient fade
        const gradient = ctx.createRadialGradient(600, 315, 0, 600, 315, 720);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 630);

        // Add hero image with shadow
        const heroSlide = loadedSlides[heroIdx].img;
        const heroWidth = 560;
        const heroHeight = (heroSlide.height / heroSlide.width) * heroWidth;
        const heroX = (1200 - heroWidth) / 2;
        const heroY = (630 - heroHeight) / 2;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 20;

        ctx.drawImage(heroSlide, heroX, heroY, heroWidth, heroHeight);

        // Return as base64
        return canvas.toDataURL('image/jpeg', 0.95);
    }, slides, heroSlide);

    await browser.close();

    console.log('✅ Preview generated\n');

    return {
        preview: previewBase64,
        slides: slides.map(s => ({ brightness: s.brightness, number: s.number }))
    };
}

// API endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { templateUrl, heroSlide = 0 } = req.body;

        if (!templateUrl) {
            return res.status(400).json({ error: 'Template URL is required' });
        }

        console.log('\n🎬 Starting generation...');
        console.log('   URL:', templateUrl);
        console.log('   Hero slide:', heroSlide + 1);
        console.log('');

        const result = await captureAndGenerate(templateUrl, heroSlide);

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
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log('');
    console.log('🎨 Social Preview Generator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📖 Open http://localhost:${PORT} in your browser`);
    console.log('');
});
