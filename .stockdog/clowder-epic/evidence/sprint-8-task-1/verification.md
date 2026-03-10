# Story 1 Verification — Direct Shadows + CTA Hover

## Build
- `npx react-router build` exits 0 ✅

## Code ACs
- `grep -c 'shadow-[var(--shadow' Step1Context.tsx` → 0 ✅
- `grep 'shadow-[var(--shadow' home.tsx` → No matches ✅ (all replaced)
- CTA hover gradient changed to `#C25D43 → #A8462E` ✅

## Changes Made
- Step1Context.tsx: 3x `shadow-[var(--shadow-sm)]` → `shadow-sm`, 2x `focus:shadow-[var(--shadow-md)]` → `focus:shadow-md`
- home.tsx: 1x `shadow-[var(--shadow-xl)]` → `shadow-xl`, 3x `shadow-[var(--shadow-sm)]` → `shadow-sm`
- app.css: CTA hover gradient endpoint darkened from `#C25D43` to `#A8462E`

## Chrome ACs
- Screenshots deferred to post-deploy verification (headless execution)
