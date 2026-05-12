# 👕 T-Shirt Designer — AI Mockup Generator

A full-stack Next.js 15 web app that uses **Google Gemini AI (Nano Banana 2)** to apply a custom design onto a plain T-shirt image and generate a realistic product mockup.

---

## Features

- **Upload T-shirt** — drag & drop or click to browse (PNG, JPG, WEBP)
- **Upload design** — your logo, graphic, or any artwork
- **AI validation** — Gemini checks the uploaded image is actually a T-shirt before generating
- **AI compositing** — Nano Banana 2 (`gemini-3.1-flash-image-preview`) realistically blends the design onto the fabric, respecting folds, wrinkles, and texture
- **Placement hint** — optionally describe where to place the design (e.g. "top-left chest")
- **Download** — export the finished mockup as PNG/JPEG
- **Retry logic** — automatically retries up to 3× on model overload (503)
- **Error boundary** — catches crashes and shows a reload screen instead of a blank page

---

## Setup

### 1. Get a Gemini API key

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.

> **Billing required** for image generation (Nano Banana 2). Enable billing in your Google Cloud project linked to the API key.

### 2. Configure environment

Edit `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

### 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
tshirt-designer/
├── app/
│   ├── api/generate/route.ts   # Server API — validates images, calls Gemini
│   ├── globals.css             # Global styles, animations, glass theme
│   ├── layout.tsx              # Root layout with ErrorBoundary
│   ├── not-found.tsx           # Custom 404 page
│   └── page.tsx                # Main UI page
├── components/
│   ├── ErrorBoundary.tsx       # Catches React crashes gracefully
│   ├── ImageDropzone.tsx       # Drag-and-drop file upload
│   ├── ResultPanel.tsx         # Result preview + download
│   └── StepBadge.tsx           # Step indicator (1→2→3→4)
├── lib/
│   ├── gemini.ts               # Gemini image generation + retry logic
│   └── validateTshirt.ts       # AI T-shirt image validator
├── .env.local                  # API key (not committed)
├── vercel.json                 # Vercel deployment config
└── ASSIGNMENT.md               # Full project documentation
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| AI — Validation | `gemini-2.5-flash` |
| AI — Generation | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| SDK | `@google/genai` |
| Icons | `lucide-react` |
| Deployment | Vercel |

---

## How It Works

1. User uploads a plain T-shirt photo and a design image.
2. On **Generate**, the client sends both files to `/api/generate`.
3. The API first calls `gemini-2.5-flash` to verify the image is a T-shirt.
4. If valid, it calls `gemini-3.1-flash-image-preview` with a prompt to composite the design onto the fabric.
5. The generated image (base64) is returned, displayed, and available for download.

---

## Deployment

```bash
# Deploy to Vercel
vercel deploy
```

Set `GEMINI_API_KEY` in Vercel → Project Settings → Environment Variables.

See [`vercel.json`](./vercel.json) for timeout and routing config.

---

## Notes

- API key is used **server-side only** — never exposed to the browser.
- Max file size: **10 MB** per image.
- Supported formats: PNG, JPG, WEBP.
- Generation typically takes **10–20 seconds**.
