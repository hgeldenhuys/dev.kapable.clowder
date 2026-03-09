# Clowder Process Improvements

Discovered during end-to-end testing (2026-03-07). Three apps built:
1. Neighborhood Tool Library (ideation -> planning)
2. Couples Habit Tracker (ideation -> planning)
3. Pet Sitting Marketplace (ideation -> planning)

## Shipped This Session

- [x] Aurora shader color fix (was rendering white due to `getOrbHexColor` returning 0xffffff for on_stage)
- [x] Luminance-only tonemapping (preserves color direction, prevents wash-out)
- [x] Markdown rendering in chat messages (bold, italic, code, bullet lists)
- [x] Error toasts on failed message sends (was silently dropping messages)
- [x] Multi-orb aurora visualizer (one ShaderCanvas per expert, click-to-foreground)
- [x] Default to first expert active when none is on_stage
- [x] Distinct orb colors per expert (cyan, violet, amber)

## UX Bugs

### Silent message send failure (FIXED)
When the POST to send a message failed, the optimistic message was silently removed.
Only `console.error` logged. Now shows sonner toast.

### Homepage submit button below fold (FIXED)
Added Cmd/Ctrl+Enter keyboard shortcut to StepWizard. Hint shown below button.

### Session creation via API doesn't auto-trigger experts
`POST /api/clowder-sessions` creates the session and redirects, but the initial
expert orchestration only fires when the first user message is sent. The homepage
form works because the redirect triggers a page load. Direct API creation leaves
the session stuck in "Assembling" state.
Fix: Trigger initial orchestration in the session creation endpoint.

## UX Polish

### "Committee discussion" label in planning phase
When no specific expert is active, the status bar shows "Committee discussion".
Should show phase-specific text like "Planning your app..." or hide entirely.

### "Skip ideation - build now" label (FIXED)
Changed to "I'm ready — start building".

### Expert labels truncated in aurora strip
With 3 experts the labels fit, but with more they may overflow. No responsive
handling for 4-5 expert names.

## Ideation Quality

### Shallow questioning depth
Experts only ask 3-4 questions before the user can force-start. Important topics
often missed: monetization, onboarding, account lifecycle, offline behavior,
accessibility. The PO system prompt could include a checklist of topics to cover.

### Static expert roster
Every session spawns the same 3 experts: Strategist, Designer, Architect.
App-specific experts would add more value:
- Couples app -> Behavioral Psychologist, Retention Expert
- Marketplace -> Trust & Safety, Payments Expert
- B2B SaaS -> Enterprise Sales, Compliance Expert

### No confidence-based phase transition
Experts have a confidence score but it never triggers automatic phase transitions.
Currently only the user can force-start. Consider: when all experts reach 60%+
confidence, auto-suggest "Your committee feels ready to plan - shall we proceed?"

## Technical Debt

### No actual build phase
Planning generates an App Spec and Implementation Backlog, but the "building"
phase is a v2 placeholder. The next milestone is connecting planning output to
actual Kapable platform provisioning (create tables, scaffold Connect App).

### WebGL canvas pixel reads impossible without preserveDrawingBuffer
The ShaderCanvas creates WebGL context without `preserveDrawingBuffer: true`,
making programmatic pixel sampling impossible (all reads return zeros). Not
blocking for users but makes automated visual testing difficult.

### Browser-typed messages may silently vanish
When typing via browser automation (or potentially fast human typing), pressing
Enter can clear the input without the optimistic message appearing in the chat.
No error toast shown — different from the API failure case. Likely a race
condition between React state update from input change and form submit. The
curl API path works reliably. Investigate whether `sendMessage` reads stale
`content` from the input ref vs state.
