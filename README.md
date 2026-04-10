# Social Preview Generator

Automated tool to generate social preview images from Supernormal template slides. Replicates Lucian's manual Figma workflow with a two-stage generation process.

## Live URL

**https://supernormal-preview-generator.vercel.app**

## How It Works

### Two-Stage Generation

**Stage 1: Capture Slides** (60-90 seconds)
- Serverless function launches headless Chrome
- Captures all 11 slides from the template
- Returns slide thumbnails for user review
- Provides stats (total slides, light/dark backgrounds)

**Stage 2: Generate Preview** (instant!)
- Client-side canvas rendering in browser
- Composes slides into 1200x630 social preview image
- Diagonal grid background pattern
- Hero slide centered with rounded corners and shadow
- Can regenerate instantly with different themes/hero slides

### Benefits

- **Better reliability** - Shorter serverless execution in Stage 1
- **Better UX** - See slide thumbnails before generating
- **Instant iteration** - Change theme/hero slide without recapturing
- **Better error handling** - Know immediately if capture fails
- **No timeout issues** - Canvas rendering is client-side

## Technical Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript with Canvas API
- **Backend**: Vercel Serverless Functions (Node.js)
- **Browser Automation**: Puppeteer + @sparticuz/chromium (serverless-optimized)
- **Deployment**: Vercel

## API Endpoints

### POST /api/capture-slides

Captures all slides from a Supernormal template URL.

**Request:**
```json
{
  "templateUrl": "https://app.supernormal.com/share/[id]/embed"
}
```

**Response:**
```json
{
  "success": true,
  "slides": [
    {
      "data": "base64-jpeg-data",
      "brightness": "light|dark",
      "number": 1
    }
  ],
  "stats": {
    "totalSlides": 11,
    "lightCount": 6,
    "darkCount": 5
  }
}
```

**Timeout:** 120 seconds

## Color Themes

- **Black** - Black background
- **White** - White background
- **Supernormal Blue** - #008EFF brand blue

## Output

- **Format**: JPEG
- **Dimensions**: 1200x630 (optimal for social media)
- **Quality**: 90%
- **Resolution**: 1.5x render scale for crisp output

## Development

```bash
npm install
vercel dev
```

## Deployment

Automatically deploys to Vercel on push to main branch.

```bash
git push origin main
```

Or manual deployment:

```bash
vercel --prod
```

## Project Structure

```
├── api/
│   └── capture-slides.js    # Stage 1: Serverless slide capture
├── public/
│   └── index.html            # Stage 2: UI + client-side canvas rendering
├── package.json
├── vercel.json              # Vercel configuration
└── README.md
```

## Configuration

`vercel.json` sets function timeout:

```json
{
  "functions": {
    "api/capture-slides.js": {
      "maxDuration": 120
    }
  }
}
```

## Notes

- Requires Vercel paid plan for 120s function timeout
- Captures exactly 11 slides per template
- Simple alternating brightness detection (even = light, odd = dark)
- Client-side rendering eliminates serverless memory constraints
