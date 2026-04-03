# Supernormal Social Preview Generator

Automatically generates social media preview images (Open Graph images) for Supernormal template pages.

## What It Does

Takes a Supernormal template URL and generates a professional 1200x630px social preview image featuring:
- All 11 slides from the template
- Isometric grid background with balanced light/dark distribution
- Hero slide prominently displayed in center with shadow
- Gradient fade for professional finish

## Local Development

```bash
npm install
npm start
```

Open `http://localhost:3456` in your browser.

## Deploy to Railway

### 1. Push to GitHub

If not already in a Git repo:

```bash
cd /Users/laurajames/Desktop/supernormal-preview-generator
git init
git add .
git commit -m "Initial commit: Social preview generator"
```

Create a new GitHub repo at https://github.com/new and push:

```bash
git remote add origin https://github.com/supernormalco/preview-generator.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Railway

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `preview-generator` repository
6. Railway will automatically detect the Dockerfile and deploy

### 3. Get Your URL

Railway will provide a public URL like:
```
https://preview-generator-production.up.railway.app
```

Your team can now access the tool at that URL!

## API Usage

### Generate Preview

**POST** `/api/generate`

```json
{
  "templateUrl": "https://app.supernormal.com/share/xxx/embed",
  "heroSlide": 0
}
```

**Response:**

```json
{
  "success": true,
  "preview": "data:image/jpeg;base64,...",
  "stats": {
    "totalSlides": 11,
    "lightCount": 4,
    "darkCount": 7
  }
}
```

### Health Check

**GET** `/api/health`

Returns `{"status": "ok"}`

## Environment Variables

- `PORT` - Server port (default: 3456, Railway sets this automatically)

## Tech Stack

- **Express** - Web server
- **Puppeteer** - Headless browser for capturing slides
- **Canvas API** - Browser-based image composition
- **Docker** - Containerized deployment with Chrome pre-installed

## How It Works

1. Launches headless Chrome with Puppeteer
2. Loads template URL and waits for React app to render
3. Clicks through all 11 slide buttons
4. Captures each slide at precise iframe coordinates (x:105, y:24, w:1230, h:692)
5. Analyzes brightness of each slide (light vs dark background)
6. Balances color distribution by alternating light/dark slides
7. Generates isometric grid background using Canvas API
8. Composites hero slide in center with shadow effect
9. Applies radial gradient fade
10. Returns 1200x630 JPEG

## Notes

- Viewport: 1440x900 (matches desktop browser)
- Slide crop area measured from iframe element
- Anti-detection flags to prevent bot blocking
- Wait time: 5 seconds after page load for full render
- Brightness threshold: 128 (0-255 scale)
