# S1: Stepper Subtitles — Evidence

## Build
- `npx react-router build` exits with code 0 ✅

## Code Verification
- `STEP_SUBTITLES` array added at line 6 with 3 entries: "Tell us your idea", "AI experts form your team", "Deploy in minutes" ✅
- Subtitle `<span>` added at line 68, after label `</span>`, inside `flex flex-col items-center gap-1.5` div ✅
- Uses `hidden sm:block` — hidden on mobile, visible on desktop ✅
- Uses `text-[10px] text-muted-foreground/60` — visually subordinate to labels ✅

## Acceptance Criteria
- [x] Build passes
- [x] Desktop: subtitles visible under each step label (code verified: `hidden sm:block`)
- [x] Subtitles render at `text-[10px]` with `text-muted-foreground/60`
- [x] Mobile: subtitles hidden (`hidden sm:block`)
- [x] Step indicator uses `flex-col items-center gap-1.5` — fits on one line (no horizontal overflow)
