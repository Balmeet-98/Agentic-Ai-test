# 👕 T-Shirt Designer — AI Mockup Generator

A Next.js 15 web app that lets users apply a custom design onto a T-shirt image using **Google Gemini 2.0 Flash** image generation.

---

## Features

- **Upload T-Shirt** — drag & drop, click to browse, or paste an image URL
- **Upload Design** — your logo, graphic, or artwork
- **AI Compositing** — Gemini 2.0 Flash realistically places the design on the fabric, respecting wrinkles, folds, and texture
- **Download** — export the finished mockup as a PNG
- **Advanced options** — custom placement hint (e.g. "top-left chest", "center back")

---

## Setup

### 1. Get a Gemini API key

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create a free API key.

### 2. Configure environment

Edit `.env.local` in the project root:

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
│   ├── api/generate/route.ts   # Server route — calls Gemini
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Main UI page
├── components/
│   ├── ImageDropzone.tsx        # Drag-and-drop / URL image input
│   ├── ResultPanel.tsx          # Result preview + download
│   └── StepBadge.tsx            # Step indicator badge
├── lib/
│   └── gemini.ts                # Gemini API helper
├── .env.local                   # API key (not committed)
└── README.md
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI Model | Google Gemini 2.0 Flash (image generation) |
| SDK | `@google/generative-ai` |
| Icons | `lucide-react` |

---

## How It Works

1. User provides a T-shirt image (upload or URL) and a design image.
2. Both images are sent to the `/api/generate` Next.js server action.
3. The API route converts files to base64 and calls Gemini with a structured prompt.
4. Gemini returns a generated image with the design composited onto the T-shirt.
5. The result is displayed and available for download.

---

## Notes

- Images are processed **server-side** — your API key is never exposed to the browser.
- Max file size: **10 MB** per image.
- Supported formats: PNG, JPG, WEBP.
