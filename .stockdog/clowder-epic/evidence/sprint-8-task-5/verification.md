# Story 5 Verification — Minimal Navigation Bar

## Build
- `npx react-router build` exits 0 ✅

## Code ACs
- `app/components/nav/NavBar.tsx` exists ✅
- `console.kapable.dev` in NavBar.tsx (Sign in link) ✅
- `pulse.kapable.run` in NavBar.tsx (Gallery link) ✅
- `id="community"` in home.tsx (anchor target for How it works) ✅
- Hero padding reduced from `pt-10 sm:pt-14` to `pt-6 sm:pt-10` ✅
- NavBar imported and rendered as first child of `<main>` ✅
- `scroll-mt-16` on community anchor for sticky nav offset ✅
