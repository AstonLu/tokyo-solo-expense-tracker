# Design Taste Guide — Tokyo Solo

Extracted from [taste-skill/redesign-skill](https://github.com/Leonxlnx/taste-skill).
This is a curated subset relevant to our **mobile-first expense dashboard**.
Not a runtime dependency — read this before building UI.

---

## How to use this guide

1. Read the brief. This is a mobile-first expense tracker, not a marketing page.
2. Key signals: minimal, clean, premium but not over-designed, data-first, two users (Aston/Amy).
3. Pull only what fits. Don't apply landing page patterns to a data app.

---

## Typography

- Use `Geist` (already in Next.js) — avoid generic Inter for all weights.
- Numbers: enable **tabular figures** (`font-variant-numeric: tabular-nums`) for amounts and totals.
- Headlines should feel intentional — tight letter-spacing, appropriate weight.
- Use `text-wrap: balance` on short headers.
- Limit paragraph/label width to ~65ch. Don't let text run edge-to-edge.
- Use Medium (500) and SemiBold (600), not just 400/700.

## Color and Surfaces

- No pure `#000000` or `#FFFFFF`. Use off-white (`#FAFAFA`) backgrounds and near-black (`#111`).
- No purple/blue "AI gradient" — the most obvious LLM design fingerprint.
- Pick **one accent color** and use it consistently. For this project: warm red/coral (Tokyo vibes).
- Tint shadows to match the surface hue, not generic black at 10% opacity.
- No random dark sections in an otherwise light page.
- Cards: remove the border OR use only background color. Not border + shadow + white together.

## Layout

- Mobile-first. Max content width ~428px (phone). Use `max-w-sm` or `max-w-md` with `mx-auto`.
- No left sidebar on mobile. Top nav or fixed bottom bar only.
- No three equal card columns. Use full-width stacked cards for mobile.
- Double the whitespace. Expense apps feel dense. Let each item breathe.
- `min-height: 100dvh` not `100vh` — prevents iOS Safari viewport jumping.
- Vary border-radius: tighter on inner elements, rounder on outer containers.

## Interactivity

- Add hover states on interactive elements (200-300ms transition).
- Add `scale(0.98)` active/pressed feedback on buttons.
- Design an empty state — don't show a blank screen when no expenses exist.
- No `window.alert()` for errors. Use inline messages.
- Loading state: skeleton that matches the layout shape, not a spinner.

## Content Writing

- Use sentence case on all headers. Not title case.
- No exclamation marks in success messages. Be confident, not loud.
- Direct error messages: "解析失敗，請確認格式" not "Oops!"
- Use real amounts in examples. Not round numbers.
- Active voice in UI copy.

## Specific to expense dashboards

- Balance display should be **prominent** — that's what users open the app to check.
- Category breakdown: horizontal scroll row of chips is cleaner than a vertical table.
- Expense rows: category emoji + merchant/item + payer tag + amount. Date is secondary.
- Confidence "needs_review" items: subtle yellow/amber left border, not a full red alert.
- Status indicators: keep them small and contextual, not banner-level.

---

## Anti-patterns to avoid for this project

- Generic white card with drop shadow on every item
- Three-column grid layout
- Purple/blue gradient anywhere
- Full-page modal for simple actions
- "Loading..." text (use skeleton instead)
- Centered layout on wide screens without a max-width container
