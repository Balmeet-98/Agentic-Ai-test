# Merch Designer — AI Mockup Generator

A full-stack Next.js 15 web app powered by **Google Gemini AI (Nano Banana 2)** that lets users design and preview artwork on any merchandise product, then generates a photorealistic mockup.

---

## Features

- **Any merchandise** — T-shirts, mugs, hats, tote bags, umbrellas, phone cases, pillows, and more
- **Three design sources:**
  - **Create with AI chatbot** — describe what you want and Gemini iteratively generates and refines artwork through a multi-turn conversation
  - **Upload artwork** — drag & drop or browse your own design file
  - **Import from library** — pull existing artwork from a connected backend CMS
- **AI product validation** — `gemini-2.5-flash` checks the uploaded image is an actual merchandise product before generating
- **AI compositing** — `gemini-3.1-flash-image-preview` (Nano Banana 2) applies the design to the product surface realistically, respecting curves, folds, and material texture
- **Placement hint** — optionally specify where to place the design
- **Download** — export the finished mockup as PNG/JPEG
- **Retry logic** — up to 3× automatic retries on model overload (503)
- **Error boundary** — graceful crash handling instead of blank screens

---

## Setup

### 1. Get a Gemini API key

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.

> **Billing required** for image generation (Nano Banana 2). Enable billing in the Google Cloud project linked to your API key.

### 2. Configure environment

Edit `.env.local`:

```env
# Required
GEMINI_API_KEY=your_key_here

# Optional — connect your artwork library backend
# ARTWORK_API_URL=https://your-client-backend.com/api
# ARTWORK_API_KEY=your_artwork_api_key_here
```

### 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Artwork Library Integration

The **"From library"** tab connects to an external artwork backend via a server-side proxy (`/api/artwork`). The client's backend must expose this REST API contract:

```
GET  {ARTWORK_API_URL}/assets
  Headers: Authorization: Bearer {ARTWORK_API_KEY}
  Response: { assets: [{ id, name, thumbnailUrl }] }

GET  {ARTWORK_API_URL}/assets/{id}/download
  Headers: Authorization: Bearer {ARTWORK_API_KEY}
  Response: binary image file (with content-type header)
```

The API key is stored server-side only — never exposed to the browser.

---

## Project Structure

```
tshirt-designer/
├── app/
│   ├── api/
│   │   ├── generate/route.ts       # Validates product + design, calls Gemini compositing
│   │   ├── design-chat/route.ts    # Multi-turn AI design chatbot API
│   │   └── artwork/route.ts        # Server-side proxy to external artwork backend
│   ├── globals.css                 # Global styles, animations, glass theme
│   ├── layout.tsx                  # Root layout with ErrorBoundary + metadata
│   ├── not-found.tsx               # Custom 404 page
│   └── page.tsx                    # Main UI page
├── components/
│   ├── ArtworkBrowser.tsx          # Browse & select artwork from connected backend
│   ├── DesignChat.tsx              # Multi-turn AI chatbot for artwork creation
│   ├── ErrorBoundary.tsx           # Catches React crashes gracefully
│   ├── ImageDropzone.tsx           # Drag-and-drop file upload
│   ├── ResultPanel.tsx             # Mockup preview + download
│   └── StepBadge.tsx               # Step indicator (1→2→3→4)
├── lib/
│   ├── gemini.ts                   # applyDesignToProduct + chatGenerateDesign + retry logic
│   └── validateProduct.ts          # AI merchandise image validator
├── .env.local                      # API keys (not committed)
├── vercel.json                     # Vercel deployment config
└── ASSIGNMENT.md                   # Full project documentation
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| AI — Validation | `gemini-2.5-flash` |
| AI — Design Chat | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| AI — Compositing | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| SDK | `@google/genai` |
| Icons | `lucide-react` |
| Deployment | Vercel |

---

## How It Works

```
User uploads product photo
  → AI validates it's actual merchandise (gemini-2.5-flash)

User chooses design source:
  A) Chat with AI → multi-turn conversation → Gemini generates artwork images
  B) Upload file → direct file upload
  C) Library tab → browse & select from connected backend

User clicks "Generate Mockup"
  → /api/generate receives product + design
  → gemini-3.1-flash-image-preview composites design onto product surface
  → Returns photorealistic mockup image

User downloads PNG
```

---

## Deployment

```bash
vercel deploy
```

Set environment variables in Vercel → Project Settings → Environment Variables:
- `GEMINI_API_KEY` (required)
- `ARTWORK_API_URL` (optional)
- `ARTWORK_API_KEY` (optional)

See [`vercel.json`](./vercel.json) for function timeout and routing configuration.

---

## Notes

- API keys are used **server-side only** — never sent to the browser
- Max file size: **10 MB** per image
- Supported formats: PNG, JPG, WEBP
- Generation typically takes **10–30 seconds** depending on model load
- The design chatbot maintains conversation history client-side and sends full context with each request
