# Ayaama — Snap your schedule. Stay on time.

Live site: https://godliver143.github.io/Ayaama/

Single-file static web app: `index.html` (everything inline, plus Tesseract.js 5.1.1 from jsDelivr).
Schedule pictures are read in the browser; nothing is uploaded. Choices are saved only in this browser's localStorage.

Edit the parts in `src/` and run `./build.sh` to rebuild `index.html`:
- `src/head.html` – styles
- `src/body.html` – page markup
- `src/core.js` – OCR text parser, A/B rotation, .ics generator (pure functions, also runs in Node)
- `src/ui.js` – page behavior

Hosting: upload `index.html` to Netlify Drop, or put it in a GitHub repo and turn on GitHub Pages. No server needed.

## Color palette

A vivid but professional look: coral-flame primary, teal accent, clean warm-white background. Text and buttons meet WCAG AA contrast.

| Token | Name | Hex | Use |
|---|---|---|---|
| `--bg` | Warm White | `#FFFBF8` | Page background |
| `--card` | White | `#FFFFFF` | Cards, inputs, choice tiles |
| `--ink` | Near Black | `#1A1816` | Headings and body text |
| `--muted` | Warm Slate | `#534E48` | Secondary text |
| `--line` | Soft Sand | `#E6E0D8` | Borders |
| `--brand` | Coral Flame | `#DC3A16` | Primary actions, logo, “Stay on time.” |
| `--brand-d` | Deep Coral | `#B02C10` | Links, hover, text on peach |
| `--brand-hot` | Bright Coral | `#E4471C` | Top of button/badge gradients |
| `--brand-soft` | Peach Mist | `#FFE4D8` | Selected cards, chips, soft fills |
| `--teal` | Teal | `#0C7A6E` | Accent, success, privacy pill, Every-day classes |
| `--teal-ink` | Deep Teal | `#085F56` | Text on teal-soft |
| `--teal-soft` | Mint | `#D9F3EF` | Pill, notes, Every-day tags |
| `--sun` | Sunny Gold | `#FFE08A` | Logo clock tick |
| `--gold` | Sun Gold | `#C48400` | Supporting gold (high-contrast) |
| `--focus` | Teal (focus) | `#0C7A6E` | Focus rings |
| `--a` | Azure | `#1264B8` | A-day coding |
| `--a-soft` | Soft Azure | `#E3F1FC` | A-day tags and card tint |
| `--b` | Violet | `#7C3AED` | B-day coding |
| `--b-soft` | Soft Violet | `#F0E7FF` | B-day tags and card tint |
| `--warn` | Alert Red | `#B91C1C` | Warnings and errors |
| `--warn-soft` | Soft Rose | `#FDE8E6` | Warning boxes |

Primary buttons, step badges, and selected day chips use a coral gradient (`#E4471C` → `#DC3A16` → `#C83212`). The header has a thin coral-to-teal bar; the hero has a soft coral and teal glow.
