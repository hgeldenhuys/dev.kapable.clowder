# Story 3: Shadow Depth Hierarchy — Verification

## Build AC
- [x] `npx react-router build` exits with code 0 — PASS

## Code ACs (verified via code inspection)
- [x] `--shadow-xl` token added to app.css:80 — `0 20px 60px rgba(51,49,46,0.14), 0 8px 20px rgba(51,49,46,0.10)`
- [x] Wizard card (home.tsx:437): `shadow-[var(--shadow-lg)]` → `shadow-[var(--shadow-xl)]` — highest elevation
- [x] Specialist preview (home.tsx:455): added `shadow-[var(--shadow-sm)]` — low elevation
- [x] Session cards (home.tsx:562): `shadow-[var(--shadow-md)]` → `shadow-[var(--shadow-sm)]` — low at rest
- [x] Session card hover: `hover:shadow-[var(--shadow-lg)]` unchanged — high on interact
- [x] Social proof (home.tsx:521): `shadow-[var(--shadow-md)]` unchanged — medium-high

## Shadow Hierarchy
| Element | Default | Hover | Level |
|---------|---------|-------|-------|
| Wizard card | xl | — | Highest |
| Social proof | md | — | Medium-high |
| Specialist preview | sm | — | Low |
| Session cards | sm | lg | Low → High |
