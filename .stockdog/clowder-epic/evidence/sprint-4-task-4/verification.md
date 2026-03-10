# S4: Template Selection Auto-Fill — Evidence

## Build
- `npx react-router build` exits with code 0 ✅

## Code Verification
- `selectedTemplate` derived state added: `STARTER_TEMPLATES.find(t => t.name === data.appName && t.description === data.description)?.name ?? null` ✅
- Visibility condition changed: `(wordCount < 20 || selectedTemplate !== null)` — grid stays visible while template selected ✅
- Ring class added: `${selectedTemplate === t.name ? 'ring-2 ring-primary border-primary/50' : ''}` ✅
- onClick handler unchanged: `onChange({ ...data, appName: t.name, description: t.description })` — already auto-fills form ✅
- No React state added — fully derived from `data.appName` + `data.description` ✅

## Acceptance Criteria
- [x] Build passes
- [x] Template click auto-fills name + description (onClick already did this)
- [x] Selected template gets `ring-2 ring-primary` highlight
- [x] Template grid stays visible after selection (visibility fix)
- [x] CTA button appears after template click (form becomes valid via S2 logic)
- [x] Clicking different template moves ring and updates fields
- [x] No template pre-selected on initial load (`selectedTemplate` = null when fields empty)
- [x] Manual edit breaks match → ring disappears → grid hides if wordCount >= 20
