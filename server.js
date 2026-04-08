const express = require('express');
const puppeteer = require('puppeteer');
const { createCanvas, loadImage } = require('canvas');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3456;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration
const SLIDE_CROP = { x: 336, y: 24, width: 895, height: 506 };
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;

async function captureSlides(templateUrl) {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('📂 Loading template:', templateUrl);
    await page.goto(templateUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for slides to load
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const slides = [];

    // Capture each slide
    for (let i = 1; i <= 11; i++) {
        console.log(`📸 Capturing slide ${i}/11...`);

        // Navigate to slide
        await page.evaluate((slideNum) => {
            const buttons = document.querySelectorAll('button[type="button"]');
            if (buttons[slideNum - 1]) {
                buttons[slideNum - 1].click();
            }
        }, i);

        await page.waitForTimeout(500);

        // Take screenshot of slide area
        const screenshot = await page.screenshot({
            clip: {
                x: SLIDE_CROP.x,
                y: SLIDE_CROP.y,
                width: SLIDE_CROP.width,
                height: SLIDE_CROP.height
            },
            encoding: 'binary'
        });

        // Analyze brightness
        const img = await loadImage(screenshot);
        const brightness = analyzeBrightness(img);

        slides.push({
            image: img,
            brightness,
            number: i
        });

        console.log(`   ✅ Slide ${i}: ${brightness.toUpperCase()}`);
    }

    await browser.close();
    console.log('✅ All slides captured\n');

    return slides;
}

function analyzeBrightness(img) {
    const canvas = createCanvas(50, 50);
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
    return avgBrightness > 128 ? 'light' : 'dark';
}

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

async function generatePreview(slides, heroIndex = 0) {
    console.log('🎨 Generating social preview...');

    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Balance slides
    const balancedSlides = balanceSlides([...slides]);

    // Isometric stack settings
    const tileWidth = 180;
    const tileHeight = 101;
    const spacing = 15;
    const rotation = -15;

    ctx.save();
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Create isometric stack
    const cols = Math.ceil((CANVAS_WIDTH * 1.5) / (tileWidth + spacing));
    const rows = Math.ceil((CANVAS_HEIGHT * 1.5) / (tileHeight + spacing));

    let slideIdx = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (slideIdx >= balancedSlides.length) slideIdx = 0;

            let x = col * (tileWidth + spacing) - (CANVAS_WIDTH * 0.75);
            const y = row * (tileHeight + spacing) - (CANVAS_HEIGHT * 0.75);

            if (row % 2 === 1) {
                x += tileWidth / 2;
            }

            ctx.drawImage(balancedSlides[slideIdx].image, x, y, tileWidth, tileHeight);
            slideIdx++;
        }
    }

    ctx.restore();

    // Apply gradient fade
    const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.6
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Add hero image with shadow
    const heroSlide = slides[heroIndex].image;
    const heroWidth = 560;
    const heroHeight = (heroSlide.height / heroSlide.width) * heroWidth;
    const heroX = (CANVAS_WIDTH - heroWidth) / 2;
    const heroY = (CANVAS_HEIGHT - heroHeight) / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 20;

    ctx.drawImage(heroSlide, heroX, heroY, heroWidth, heroHeight);

    console.log('✅ Preview generated\n');

    return canvas;
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

        // Capture slides
        const slides = await captureSlides(templateUrl);

        // Generate preview
        const canvas = await generatePreview(slides, heroSlide);

        // Convert to base64
        const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
        const base64 = jpegBuffer.toString('base64');

        // Stats
        const lightCount = slides.filter(s => s.brightness === 'light').length;
        const darkCount = slides.filter(s => s.brightness === 'dark').length;

        console.log('📊 Stats:');
        console.log(`   Total slides: ${slides.length}`);
        console.log(`   Light backgrounds: ${lightCount}`);
        console.log(`   Dark backgrounds: ${darkCount}`);
        console.log('');
        console.log('✨ Done! Preview ready for download\n');

        res.json({
            success: true,
            preview: `data:image/jpeg;base64,${base64}`,
            stats: {
                totalSlides: slides.length,
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

// Health check
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
