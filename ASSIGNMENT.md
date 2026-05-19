# T-Shirt Designer — AI Mockup Generator

## Assignment Overview

This project is a full-stack AI-powered web application that allows users to apply a custom design onto a plain T-shirt image and generate a realistic product mockup — built entirely with **Next.js** and **Google Gemini AI (Nano Banana)**.

---

## Problem Statement

> A user uploads a plain T-shirt image and a custom design image. The system uses Google Gemini AI to apply that design onto the T-shirt and generate a final realistic output image.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| AI Model (Validation) | Google Gemini 2.5 Flash (`gemini-2.5-flash`) |
| AI Model (Generation) | Google Gemini 3.1 Flash Image (`gemini-3.1-flash-image-preview`) — **Nano Banana 2** |
| SDK | `@google/genai` (official Google GenAI SDK) |
| Icons | `lucide-react` |
| Deployment | Vercel |

---

## Project Structure

```
tshirt-designer/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts        # Server-side API — validates + calls Gemini
│   ├── globals.css             # Global styles, animations, glass theme
│   ├── layout.tsx              # Root layout with ErrorBoundary
│   ├── not-found.tsx           # Custom 404 page
│   └── page.tsx                # Main UI — full application page
│
├── components/
│   ├── ErrorBoundary.tsx       # React error boundary — prevents blank screens
│   ├── ImageDropzone.tsx       # Drag & drop / click-to-upload image input
│   ├── ResultPanel.tsx         # AI result display with download button
│   └── StepBadge.tsx           # Step indicator (1→2→3→4)
│
├── lib/
│   ├── gemini.ts               # Gemini image generation with retry + fallback
│   └── validateTshirt.ts       # Gemini AI T-shirt image validator
│
├── .env.local                  # API key (not committed)
├── vercel.json                 # Vercel deployment config
└── ASSIGNMENT.md               # This file
```

---

## Features

### Core Functionality
- **Upload T-shirt image** — drag & drop or click to browse (PNG, JPG, WEBP, max 10 MB)
- **Upload design image** — logo, graphic, or any artwork
- **AI Mockup Generation** — Gemini AI applies the design realistically onto the T-shirt, respecting fabric folds, wrinkles, and texture
- **Download result** — export the generated mockup as a PNG/JPEG

### AI Pipeline

```
User uploads T-shirt + Design
         │
         ▼
  ┌─────────────────────────────┐
  │  Step 1: T-Shirt Validation │  ← gemini-2.5-flash (text model)
  │  "Is this a T-shirt?"       │     Fast, cheap validation call
  └─────────────────────────────┘
         │ ✓ valid         │ ✗ invalid
         │                 └──→ Return error + shake animation
         ▼
  ┌─────────────────────────────┐
  │  Step 2: Image Generation   │  ← gemini-3.1-flash-image-preview
  │  Apply design onto shirt    │     Nano Banana 2 model
  │  Retry 3× on 503 overload   │
  └─────────────────────────────┘
         │
         ▼
  Return base64 image to client
```

### Smart Error Handling
- **Wrong image type** — Gemini validates whether the uploaded image is actually a T-shirt; if not, it shakes the upload card and shows a specific error
- **Missing uploads** — clicking Generate without images triggers a shake animation + inline red message on the missing field
- **Model overloaded (503)** — automatic retry with exponential backoff (3s → 6s → 9s), up to 3 attempts
- **API errors** — quota exceeded, invalid key, model not found — all shown as dismissible error banners at the top of the page

### UX Details
- **4-step progress indicator** — Upload Shirt → Upload Design → Generate → Download
- **Placement hint** (Advanced options) — optionally describe where to place the design (e.g. "top-left chest")
- **Sticky result panel** on desktop — result stays visible while scrolling
- **Error boundary** — catches React crashes and shows a "Reload Page" screen instead of a blank white screen
- **Custom 404 page** — friendly not-found page with navigation back to the app
- **Responsive** — single column on mobile, two-column grid on desktop

---

## How It Works — Step by Step

### 1. User uploads images
The `ImageDropzone` component handles file selection via drag-and-drop or the file picker. Object URLs are created with `useEffect` and properly revoked to avoid memory leaks.

### 2. Client-side validation
Before hitting the API, `handleGenerate` checks that both images are present. If not, it triggers a CSS shake animation and inline error on the missing card — no API call is wasted.

### 3. Server-side AI validation (`/api/generate`)
The Next.js API route receives both images as `multipart/form-data`. It first calls `validateTshirtImage()` which sends the T-shirt image to `gemini-2.5-flash` with a structured prompt asking if it's a wearable garment. The model responds with `{"isTshirt": true}` or `{"isTshirt": false, "reason": "..."}`.

### 4. Gemini image generation
If validation passes, `applyDesignToTshirt()` sends both images to `gemini-3.1-flash-image-preview` (Nano Banana 2) with a detailed prompt instructing it to:
- Preserve the T-shirt's original color, folds, and wrinkles
- Blend the design naturally onto the fabric texture
- Respect fabric curvature and lighting

### 5. Retry logic
If the model returns a 503 (high demand), the system waits 3s and retries — up to 3 times — before giving up and returning an error to the client.

### 6. Result display
The base64-encoded image is returned to the client and rendered in the `ResultPanel`. The user can download it as a file named `tshirt-mockup-<timestamp>.png`.

---

## Setup & Running Locally

### 1. Install dependencies
```bash
cd tshirt-designer
npm install
```

### 2. Add Gemini API key
Edit `.env.local`:
```env
GEMINI_API_KEY=your_api_key_here
```
Get a key at: https://aistudio.google.com/app/apikey

> **Note:** Image generation (Nano Banana 2) requires billing to be enabled. Validation uses `gemini-2.5-flash` which is available on the free tier.

### 3. Run development server
```bash
npm run dev
```
Open http://localhost:3000

---

## Deployment (Vercel)

The `vercel.json` config handles:
- **Function timeout** — 60 seconds for `/api/generate` (Gemini can take 10–30s)
- **SPA routing fallback** — all non-asset URLs rewrite to `/` so page refresh works correctly
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- **CORS headers** on API routes

### Deploy steps
1. Push to GitHub
2. Import repo at vercel.com → set **Root Directory** to `tshirt-designer`
3. Add `GEMINI_API_KEY` in Vercel environment variables
4. Deploy

---

## API Reference

### `POST /api/generate`

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `tshirt` | File | ✅ | T-shirt image (PNG/JPG/WEBP, max 10 MB) |
| `design` | File | ✅ | Design/artwork image (PNG/JPG/WEBP, max 10 MB) |
| `placement` | string | ❌ | Hint for design placement (e.g. "center chest") |

**Response — success**
```json
{
  "imageBase64": "<base64 string>",
  "mimeType": "image/jpeg",
  "modelUsed": "gemini-3.1-flash-image-preview"
}
```

**Response — error**
```json
{
  "error": "Human-readable error message",
  "invalidTshirt": true   // only when T-shirt validation fails
}
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Server-side API key | API key never exposed to the browser |
| Two-model pipeline | Fast cheap validation before expensive generation |
| Retry with backoff | Gemini image models experience demand spikes |
| File upload only (no URL) | URL fetching was unreliable — many hosts block server-side requests |
| Error boundary | Prevents blank white screens on unexpected React crashes |
| `useEffect` for object URLs | Prevents memory leaks from stale blob URLs |
