# Player Color Palette

This app uses CSS variables for Player pages (see `src/styles/playerNeoNoir.css`).

## Light theme (Player default)
**Name:** Antique Chess Club

- Light square (`--chess-light-square`): `#E1C9A1`
- Dark square (`--chess-dark-square`): `#6B4A2D`
- Background (`--cream` / `--page-bg` / `--content-bg`): `#E1C9A1`
- Primary UI (`--sea-green`): `#3E2A1A`
- Accent (`--sky-blue`): `#9C7A4A`
- Text (`--text-color`): `#23170E`
- On accent (`--on-accent`): `#E1C9A1`
- Card gradient (`--card-bg`): `linear-gradient(180deg, #E1C9A1, rgba(156,122,74,0.16))`
- Borders (`--border-color`): `rgba(62,42,26,0.16)`

## Dark theme (Player toggled)
**Name:** Custom 5-color green/blue dark palette

- Base 1 (`--page-bg`): `#020A08`
- Base 2 / content surface (`--neo-charcoal`): `#0F1F1A`
- Primary (`--neo-cyan`): `#22C55E`
- Accent (`--neo-blue`): `#3B82F6`
- Text (`--neo-cream`): `#DCFCE7`
- Muted (`--neo-silver`): `rgba(220,252,231,0.76)`

Mapped variables used by the UI:
- Primary (`--sea-green`): `var(--neo-cyan)`
- Accent (`--sky-blue`): `var(--neo-blue)`
- Page background (`--page-bg`): `#020A08`
- Content background (`--content-bg`): `var(--neo-charcoal)` (=`#0F1F1A`)
- Cards (`--card-bg`): `linear-gradient(135deg, rgba(2,10,8,0.92), rgba(15,31,26,0.84))`
- Card border (`--card-border`): `rgba(59,130,246,0.12)`
- Text (`--text-color`): `var(--neo-cream)`
- Borders (`--border-color`): `rgba(34,197,94,0.18)`

## Where it’s applied
- Player pages use the `.player` class.
- Dark mode uses `.player.player-dark`.

If you want different shades (more contrast / more vibrant), tell me which direction (lighter background, deeper slate, more neon cyan, etc.) and I’ll tune the palette while keeping the same variable names.
