# Story 2 Verification — Hero Headline Size + Ghost-Opacity Text Pass

## Build
- `npx react-router build` exits 0 ✅

## Code ACs
- Step1Context.tsx: 0 ghost-opacity matches ✅
- StepWizard.tsx: 0 ghost-opacity matches ✅
- StepIndicator.tsx: 0 ghost-opacity matches ✅
- home.tsx: only 3 remaining (lines 662-664, Story 4 scope) ✅
- `text-stone-500` present on template category labels ✅
- Hero headline bumped to `text-2xl sm:text-3xl md:text-4xl lg:text-5xl` ✅

## Changes Made
- home.tsx: headline size increase + 13 ghost-opacity replacements
- Step1Context.tsx: 8 ghost-opacity replacements
- StepWizard.tsx: 1 ghost-opacity replacement
- StepIndicator.tsx: 3 ghost-opacity replacements
