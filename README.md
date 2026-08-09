# PixelBoost

Private, browser-based image upscaling.

Upload a photo, choose 2× / 4× / 8×, compare the result, and download PNG, JPG, or WebP. All processing runs locally in your browser — files are never uploaded.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Stack

- Vite + React + TypeScript
- Client-side progressive resampling with a light sharpen pass
