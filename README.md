# Blackjack Strategy Trainer ♠️

Practice and master basic blackjack strategy. Two modes: **Training** (learn optimal plays) and **Playing** (full game simulation).

**Rules:** H17 · 6 Decks · No Surrender

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev
```

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start Vite dev server on port 3000   |
| `npm run build`   | Type-check + production build → `dist/` |
| `npm run preview` | Preview production build locally     |
| `npm run lint`    | Run TypeScript type-check only       |

## Deployment (GitHub Pages)

Deployment is **fully automatic** via GitHub Actions.

### One-time setup

1. Go to your repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` — the workflow builds and deploys automatically

The site will be live at `https://<your-username>.github.io/Blackjack_training_playing/`

> **Note:** If deploying under a subpath, set `base` in `vite.config.ts`:
> ```ts
> base: '/Blackjack_training_playing/',
> ```

### Manual deploy

You can also trigger a deploy from the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS (CDN)

## Project Structure

```
├── index.html          # Entry HTML
├── index.tsx           # React entry point
├── App.tsx             # Main app (menu / mode routing)
├── components/
│   ├── TrainingMode.tsx
│   ├── PlayingMode.tsx
│   ├── Card.tsx
│   ├── Controls.tsx
│   └── Feedback.tsx
├── utils/              # Strategy logic & helpers
├── types.ts            # Shared TypeScript types
├── vite.config.ts
├── tsconfig.json
└── .github/workflows/deploy.yml
```
