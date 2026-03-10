# Story 4 Verification — Footer Social Links + Hover States

## Build
- `npx react-router build` exits 0 ✅

## Code ACs
- `rel="noopener noreferrer"` count: 10 (3 new social links added) ✅
- `hover:text-foreground/70` in footer (lines 660-690): 0 ✅
- 3 social icons (Twitter/X, GitHub, Discord) inserted ✅
- Footer links have `hover:text-stone-700 hover:underline` ✅
- "Build something" link changed from `text-primary/70 hover:text-primary` to `text-primary hover:underline` ✅
