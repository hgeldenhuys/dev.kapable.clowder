# Clowder Living Backlog

> Last updated: 2026-03-10 (post sprint 11 retro)
> Judge score: 7.3/10 (lively-eagle — independent judge, visual + code analysis methodology)
> 5-sprint rolling average: 7.0, 7.0, 7.0, 7.2, 7.3 → **7.1**
> Next target: 7.5 (+0.2)
> Priority order: lowest judge dimensions first — **Trust 6.5**, Interactions 7.0, Visual 7.5, Typography 7.5, Color 7.5, Mobile 7.5, Layout 8.0, Form 8.5
> Rule: content tasks labeled [CONTENT], CSS/code tasks unlabeled
> Regression items marked [REGRESSION FIX]
> Diagnostic items marked [DIAGNOSTIC]
> Recalibration items marked [RECALIBRATION]
> Three-strike items marked [THREE-STRIKE] — require 2 alternative approaches + visual verification
> Structural items marked [STRUCTURAL] — require new components or layout restructuring, estimated at 2x CSS effort
> Lovable gap: -1.9 overall. Largest: Trust -3.0, Interactions -2.5. Smallest: Form UX 0.0, Layout -1.0

## Completed (Sprint 1)
- [x] Set up shadcn (components.json, cn() util, core components) — `54d0198`
- [x] Fix typography — confident sizes, Outfit font, proper hierarchy — `a315f5f`
- [x] Fix all ghost opacity (minimum 60% for text, 40% for borders) — `a315f5f`
- [x] Rebuild wizard form with shadcn Card, Input, Button — `55f66ad`
- [x] Template cards with hover effects, proper spacing — `16c0d9a`
- [x] Mobile overflow fix + heading responsive sizes — `3677111`

## Completed (Sprint 2)
- [x] Add visual depth to wizard card — glass-card + shadow-lg + border-border/50 — `ffba31f`
- [x] Add gradient/texture to hero area — radial opacity boost (#E07A5F18→28, #81B29A12→20, #E8A83810→18) — `ffba31f`
- [x] Fix disabled CTA button — .hero-cta:disabled rule (warm stone bg, stone-400 text, stone-300 border) — `ffba31f`
- [x] Real mobile breakpoints — flex-col sm:flex-row templates, conditional scroll/snap, hidden fade overlay — `ffba31f`
- [x] Mobile footer — stack links vertically, flex-col sm:flex-row gap-3 sm:gap-6, touch targets — `ffba31f`
- [x] Replace emoji template icons with inline SVGs in gradient thumbnail divs (4 distinct colors) — `ffba31f`
- [x] Reframe stats section — threshold >= 50, "Join builders" always visible — `ffba31f`
- [x] Increase sub-tagline to text-sm text-muted-foreground/80, green dots w-1.5→w-2 — `ffba31f`

## Completed (Sprint 3)
- [x] Desktop layout: widen to `max-w-4xl` (896px) + session cards 2-col grid — `6c74168`
- [x] Template cards: horizontal scroll → `grid grid-cols-1 sm:grid-cols-2 gap-3` — `a0e045c`
- [x] Shadow depth hierarchy: wizard `shadow-xl`, specialist `shadow-sm`, sessions `shadow-sm`/`hover:shadow-lg` — `8f093c4`
- [x] AI team preview entrance animation: fade-in + staggered chip cascade — `0f52656`

## Completed (Sprint 4)
- [x] CTA overhaul: hide button entirely until form valid, reveal with slide-in animation — `617b623`
- [x] Audit CSS cascade — eliminated disabled state entirely (no cascade to audit) — `617b623`
- [x] Add helper text below form: "Enter a name and 20+ word description to get started" — `617b623`
- [x] CTA hover: `hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]` — `617b623`
- [x] Hover: `hover:-translate-y-1 hover:shadow-lg` on template cards — `4c17cb8`
- [x] Increase `--shadow-lg` CSS variable globally — `4c17cb8`
- [x] Stepper subtitles for Describe/Assemble/Build — `59740b2`
- [x] Template selection ring highlight (derived state, ring-2 ring-primary) — `4443875`
- [x] Session card names: `line-clamp-2` instead of single-line truncate — `cf47ee3`
- [x] Hide Cmd+Enter shortcut on mobile: `hidden sm:inline` — `617b623`
- [x] Value props: fix wrapping on narrow screens — `flex-wrap gap-y-1 whitespace-nowrap` — `cf47ee3`

## Completed (Sprint 5)
- [x] Template card gradient headers — 60px colored header band with centered icon, category subtitles — `a412323` (S1)
- [x] Template card tint opacity: increased from ~5% to 15-25% — `a412323` (S1)
- [x] [CONTENT] Social proof: stats counter + Pulse showcase link "See Pulse — built in 10 minutes" — `a412323` (S2) — NOTE: stats counter backfired at low volume
- [x] Remove "Join the builders creating apps with AI" heading — `a412323` (S2)
- [x] Session card hover: `hover:-translate-y-1 cursor-pointer` + removed `.session-card` CSS — `a412323` (S3)
- [x] Session card "Open app" hover: `hover:underline` — `a412323` (S3)
- [x] Footer touch targets: `py-2` → `py-3` (44px+) — `a412323` (S4)
- [x] Footer link contrast: `text-muted-foreground/70` → `text-foreground/50` — `a412323` (S4)
- [x] CTA slide-in animation: replaced non-rendering `tw-animate-css` with custom `@keyframes slide-in-cta` — `a412323` (S5)

## Completed (Sprint 6)
- [x] Boost shadow variables + card rest states — `--shadow-sm` opacity 0.08→0.15/0.12→0.18, pulse card rest shadow — `7ea6f76` (S1)
- [x] Aggressive hover overhaul — `hover:bg-primary/5 hover:border-primary/20` on template/session/pulse cards — `783f48b` (S2) — NOTE: hover still invisible, opacity too low
- [x] Hide stats counter below threshold — `sessions.length >= 50` guard, Pulse link remains visible — `aff428d` (S3)
- [x] Darken secondary text pass — multiple opacity increases across template/session/footer text — `ad621d7` (S4)
- [x] Section dividers between content areas — "Community" labeled divider, spacing adjustments — `be649a6` (S5)

## Completed (Sprint 7)
- [x] Force light color scheme meta tag — `<meta name="color-scheme" content="light only" />` — `a425ef6` (S1)
- [x] Visible hover colors on template cards — named colors (`hover:bg-orange-50`, `hover:border-orange-300`) replacing opacity fractions — `924bf1a` (S2)
- [x] Visible hover colors on session cards + pulse link — same named-color approach — `cb4ec65` (S3)
- [x] Center CTA button — conditional `justify-center` (step 1) / `justify-between` (step 2+) — `c48bd36` (S4)
- [x] Always-visible disabled CTA state — `bg-stone-200 text-stone-400 cursor-not-allowed` + tooltip — `c48bd36` (S5)

## Completed (Sprint 8)
- [x] Direct shadows on ALL cards — replaced `shadow-[var(--shadow-sm)]` → `shadow-sm` (6x Step1Context, 3x home.tsx) + CTA hover gradient darkened — `a00b67f` (S1)
- [x] Hero headline size `text-2xl→text-5xl` + ghost-opacity text pass — 25 instances replaced with named stone palette — `8dd5c99` (S2)
- [x] Skill tag pills warm colors — `bg-orange-50 text-orange-700 border-orange-200` — `bb8ec2d` (S3)
- [x] Footer social links (X, GitHub, Discord) + hover states — `e62ee2e` (S4)
- [x] [CONTENT] Minimal navigation bar — Logo, "How it works", Gallery, Sign in — `b36aefe` (S5)

## Completed (Sprint 9)
- [x] Fix "Gallery" nav link → "See Pulse" (honest label) — `34e018b` (S1)
- [x] Fix CTA disabled state contrast — `bg-stone-300 text-stone-600 border-stone-400 shadow-sm` — `14f8374` (S2) — NOTE: judge says still insufficient on cream
- [x] Card resting shadows `shadow-md` + template header named colors (orange-200, emerald-200) — `1b9005f` (S3) — NOTE: judge says shadow-md still invisible on cream
- [x] Cross-cutting text/contrast: gradient #5B9A7F, text-xs minimum on small text, stone-500/600 on labels — `cbc138c` (S4) — NOTE: judge says gradient still borderline
- [x] [CONTENT] "How it works" 3-step explainer section with SVG icons — `5fbfbd4` (S5) — judge confirmed: "genuine addition"
- [x] Fix "How it works" nav link → honest anchor to explainer section — `5fbfbd4` (S5)

## Completed (Sprint 10)
- [x] [THREE-STRIKE] CTA disabled — dark fill with white text (`bg-stone-500 text-white border-stone-600 shadow-md`) — `3ec3e2d` (S1) — judge confirmed: "clearly identifiable as a button"
- [x] Card resting shadows — shadow-lg minimum on all cards (template, session, pulse) — `8bb8e5d` (S2) — judge confirmed: "read as elevated surfaces"
- [x] Hover intensity 2x — `scale-[1.06] -translate-y-3` on template cards, `-translate-y-3` on session cards — `ec766d7` (S3) — judge confirmed: "perceptible at normal viewing distance"
- [x] Focus ring visibility — `ring-2 ring-orange-300` on inputs, textarea, Step1Context — `9a58bcc` (S4) — judge confirmed: "clearly visible"
- [x] Helper text contrast floor — bulk pass `text-stone-400` → `text-stone-500` across 6 files — `5b3ad0e` (S5) — judge confirmed: "now readable"

## Completed (Sprint 11)
- [x] [STRUCTURAL] **[P0] Mobile hamburger menu** — nav collapse below `sm:` breakpoint, useState toggle, animated slide-down panel, 44px+ touch targets — `5dc255c` (S1+S4) — judge confirmed: "clean, standard pattern"
- [x] [STRUCTURAL] **Mobile form-first layout** — CSS `order-` reordering, form above templates on mobile — `3d4f74b` (S2) — judge confirmed: "genuinely smart UX decision"
- [x] **CTA disabled-to-active transition polish** — grayscale+opacity approach with `duration-300` — `97d1b22` (S3) — judge confirmed: "visible and meaningful"
- [x] **Nav link hover color upgrade** — `hover:text-orange-700 hover:underline underline-offset-4` — merged with S1 in `5dc255c` (S4) — **NOTE: judge reports NOT FIXED — [DIAGNOSTIC] created**
- [x] **Value prop text weight boost** — `text-stone-600 font-medium` — `c394935` (S5) — judge says "slightly improved" (PARTIALLY DONE per judge)

---

## Priority 1 — Trust & Credibility (judge: 6.5 — LOWEST dimension, revised down from 7.0)

Trust is now the single largest barrier to competitive credibility. Lovable gap: -3.0. WoW rule: "Trust < 7.5 requires 2 content stories per sprint."

- [ ] [CONTENT] **[P1] Social proof section** — "X apps built this week" counter from Data API + 2-3 user quotes/testimonials. The single largest trust gap. (source: judge P2-7, sprint 11)
- [ ] [CONTENT] **[P1] Fix session card titles** — raw prompts ("Build a comprehensive pet adoption...") truncated mid-sentence. Use appName field or first clause or 40 chars + ellipsis. Database leakage undermines social proof. (source: judge P1-3, sprints 10+11)
- [ ] [CONTENT] **Expand COMMUNITY to 3-5 apps** — single "See Pulse" highlights ecosystem thinness. Actually hurts trust. (source: judge P2-8, sprints 10+11)
- [ ] [CONTENT] **"Built with Clowder" gallery page** — 5-10 delivered apps with screenshots (source: judge P2-13)
- [ ] [CONTENT] **1-2 short testimonials** below HOW IT WORKS section (source: judge P2-9)
- [ ] [CONTENT] **Add trust badges** — "Powered by Claude" or tech stack logos (source: judge P2-12)
- [ ] Lower stats display threshold — `sessions.length >= 50` → `>= 1`. "6 apps built" is social proof > nothing. (source: judge P1-7) — BUT: sprint 5 learned low numbers are anti-proof. Evaluate threshold carefully.
- [ ] [CONTENT] FAQ or pricing section — "Is this really free? What are the limits?" (source: judge)
- [ ] Expand footer: product columns, company info (source: judge P2)
- [ ] [CONTENT] Clarify "Your Apps" — personal vs community, add section header (source: judge)
- [ ] Personalization: greet returning users — "Let's build something, [Name]" (source: judge P2)

## Priority 2 — Interactions (judge: 7.0 — Lovable gap -2.5)

The experiential gap: no animations, no motion, no scroll effects. Single biggest "feel" improvement area.

- [ ] **[P0] Mobile textarea text overlap** — helper text overlaps placeholder at 375px. Position outside textarea or hide when empty. 15 min fix. (source: judge P0-1, sprint 11)
- [x] [DIAGNOSTIC] **Verify nav hover states on production** — RESOLVED sprint 12: independent visual verification confirms hover deployed. Discrepancy was timing/viewport issue. Evidence: `evidence/sprint-12-research/`
- [ ] **[P1] Entrance animations** — hero text + wizard card stagger fade-slide-in on page load. CSS @keyframes or framer-motion. Single biggest experiential improvement. (source: judge P1-2, sprints 10+11)
- [ ] **[P1] Session card hover states** — `hover:shadow-md transition-shadow cursor-pointer`. Users don't realize they're clickable. (source: judge P1-5, sprint 11)
- [ ] **Expert tag entry animation** — tags pop in all at once, should fade-in individually. (source: judge P2-10, sprint 11)
- [ ] **CTA state transition animation** — `transition-colors duration-300` on Build button. 5 min fix. (source: judge P1-5, sprint 10) — NOTE: sprint 11 S3 added duration-300 but judge says only "IMPROVED" not fixed
- [ ] **Button press/active state** — `active:scale-[0.98]` on CTA. (source: judge sprint 10)
- [ ] **Template card clickability affordance** — add "Use template" text on hover or subtle arrow indicator (source: judge)
- [ ] **No loading feedback after CTA click** — add spinner/progress indicator (source: judge)
- [ ] **"Sign in" button hover** — add `hover:shadow-sm hover:scale-[1.02]` (source: judge)
- [ ] **Footer "Build something →" arrow animation** — `group-hover:translate-x-1 transition-transform` (source: judge)
- [ ] **Add positive validation feedback** — green check / "Ready!" when form valid (source: judge P1-8)
- [ ] Stepper: highlight current step based on form state — Describe when typing, Assemble when team preview (source: judge P2-14)
- [ ] Loading skeletons for "Your Apps" section (carried from sprint 1)
- [ ] Page transitions (fade/slide) (carried from sprint 1)

## Priority 3 — Visual Polish (judge: 7.5 — Lovable gap -2.0)

Card shadows fixed. 8.0+ requires non-CSS work: entrance animations, hero visual, template previews.

- [ ] **[P1] Hero visual depth** — gradient band, aurora wash, or subtle illustration behind hero text. Single biggest "first impression" fix. Doesn't need Lovable-level drama — even a soft warm gradient would add energy. (source: judge P1-6, sprints 10+11)
- [ ] **Template preview thumbnails** — small screenshot or mockup on template cards. Lovable shows actual app screenshots. (source: judge P2-9, sprint 11)
- [ ] **Background depth layer** — subtle radial gradient or warm noise texture behind main card. Break the flat cream monotony. (source: judge P2-11)
- [ ] Hero floating orbs — `bg-primary/5` → `bg-primary/10` or `bg-primary/15` for visible ambient warmth (source: judge)
- [ ] Session card left accents: widen to 4-6px + `shadow-sm` (source: judge)
- [ ] Main content card: distinct bottom boundary — dissolves into background (source: judge P2)
- [ ] Apply warm accent colors broadly — amber/orange tints for card borders (carried from sprint 1)
- [ ] Phase colors — extract inline hex to CSS custom properties (source: discovery)

## Priority 4 — Typography (judge: 7.5 — Lovable gap -1.5)

- [ ] **[P1] Fix session card raw prompt titles** — truncate intelligently, don't end on "that"/"where". First sentence or 40 chars + ellipsis. Database leakage. (source: judge P1-4, sprints 10+11) — cross-listed with Trust P1
- [ ] **HOW IT WORKS body text** — too small and light for key explanatory content. Bump to text-sm and darken. (source: judge)
- [ ] **"Or start with a template" divider text** — very light, almost ghost text. Darken. (source: judge sprint 10)
- [ ] Darken step subtitles — increase weight to 500 or darken to `text-stone-600` (source: judge)
- [ ] "COMMUNITY" header: soften from cold all-caps tracking to warmer brand style (source: judge)
- [ ] **"We'll build it." sage gradient** — still lower contrast than bold text above. Darken endpoint. (source: judge sprint 10)
- [ ] **Value prop opacity boost** — sprint 11 added `font-medium` but judge says "slightly improved" — may need bolder treatment. (source: judge P2-11, sprints 10+11)
- [ ] **Nav link font weight** — "How it works", "See Pulse" are thin. Add font-medium. (source: judge sprint 10)

## Priority 5 — Color & Contrast (judge: 7.5 — Lovable gap -1.5)

- [ ] **Section label contrast** — "HOW IT WORKS", "COMMUNITY" near-invisible light gray on cream. To `text-stone-600` or `text-foreground/60`. (source: judge sprint 10)
- [ ] **Gradient text: #4A8A6E or darker** — `#5B9A7F` is 3.8:1 on cream, below 4.5:1 comfort threshold. Need computed contrast verification. (source: judge P0-3)
- [ ] [DIAGNOSTIC] **DevTools computed-style audit on cream** — validate all elements' actual contrast ratios against #FAF8F5. Multiple elements pass in code but fail visually. (source: judge recalibration)
- [ ] **Sub-tagline text** — `text-stone-500` → `text-stone-600` for comfortable reading (source: judge)
- [ ] Textarea focus ring: warm-toned (amber/coral) instead of teal/green (source: judge) — NOTE: sprint 10 changed to orange-300, may be resolved
- [ ] Step icons: add warm fill background circle — `bg-orange-50 p-2 rounded-full` (source: judge)
- [ ] Template fade overlay — `from-white/90` → `from-background/90` for dark mode readiness (source: discovery)

## Priority 6 — Mobile (judge: 7.5 — recovered from 6.5, +1.0 sprint 11, Lovable gap -1.0)

Sprint 11 closed the structural gap. Remaining items are refinement.

- [ ] [STRUCTURAL] **3-step icons vertical stack on mobile** — wizard icons (Describe, Assemble, Build) crammed horizontally at 375px. (source: judge sprint 10)
- [ ] **Footer social icon touch targets** — add `p-2` wrapper for 44px targets (source: judge)
- [ ] [REGRESSION FIX] **Verify `⌘+Enter` hidden on mobile** — may have regressed in sprint 7 StepWizard.tsx changes (source: judge + regression check)
- [ ] Value props: individual badge pills on mobile instead of wrapping text (source: judge)
- [ ] 3-step wizard: hide sub-labels on mobile or compact layout (source: judge)
- [ ] Session card titles on mobile: use short app names, not full descriptions (source: judge)
- [ ] Template card descriptions: show full text or meaningful truncation on mobile (source: judge)
- [ ] Consider sticky bottom CTA on mobile when form is filled (source: judge P2)
- [ ] Word counter: move below textarea on mobile — overlaps content (source: judge P2)
- [ ] Establish reliable automated mobile viewport testing — Chrome DevTools device emulation or Playwright (source: friction — 5+ sprints unsolved)

## Priority 7 — Layout (judge: 8.0 — plateau 3 sprints, Lovable gap -1.0)

- [ ] **Session card min-height** — `min-h-[120px]` for even 2-col grid heights. (source: judge sprint 10)
- [ ] **Tighten spacing between main card and HOW IT WORKS** — dead zone of cream between sections (source: judge sprint 10)
- [ ] Step indicator more compact — horizontal pill bar or reduce vertical padding (source: judge)
- [ ] "Your Apps" section visual grouping — reduce gap or add background tint (source: judge)
- [ ] "Your Apps": cap at 4-6 items with "View all" link (source: judge P1)
- [ ] Footer: two-column layout (brand left, links right, social) for desktop (source: judge)
- [ ] Wide desktop (1440px): consider max-width 640px or two-column (form left, templates right) (source: judge)
- [ ] Keep template cards visible while form is being filled (carried from sprint 1)
- [ ] **COMMUNITY section with single card feels thin** — visual balance issue once content expands (source: judge sprint 10)

## Priority 8 — Form UX (judge: 8.5 — highest dimension, parity with Lovable)

Strongest dimension. Domain tag preview is a genuine competitive advantage. Minimal investment needed.

- [ ] **Auto-resize textarea** — fixed height forces scrolling in small box. (source: judge sprint 10)
- [ ] **Inline validation** — "Need X more words" progressive counter. Only signal is disabled button. (source: judge sprint 10)
- [ ] **Left-align form labels** — UX research favors left-aligned labels above left-aligned inputs. (source: judge sprint 10)
- [ ] **Helper text placement** — "Describe your idea to get started" is right-aligned inside textarea. Move below. (source: judge sprint 10)
- [ ] **Clear/reset affordance** after selecting a template. (source: judge sprint 10)
- [ ] Word count color progression: red (<10) → yellow (10-19) → green (20+) (source: judge P1)
- [ ] Word counter: differentiate from hint text — `text-xs text-muted-foreground/60` (source: judge)
- [ ] Add visible minimum for app name — green checkmark at >=3 chars (source: judge)
- [ ] Textarea auto-grow for long descriptions — avoid scrollbar (source: judge)
- [ ] Hero area breathing room: `py-8 sm:py-12` above card container (source: judge)
- [ ] Template/form sections: visual separation within card — different purposes (source: judge)

## Priority 9 — Component Polish (not judged as dimension)

- [ ] Remove ugly custom scrollbar CSS
- [ ] Session page layout — proper sidebar, breadcrumbs, phase badges
- [ ] Chat messages with shadcn Card, proper bubble styling
- [ ] Footer that's actually visible
- [ ] Typing indicator with expert name
- [ ] Scroll-to-bottom in chat
- [ ] Step indicator progress bar in wizard

## Priority 10 — E2E Reliability

- [ ] Test full flow: describe → experts → ideation → build → deploy
- [ ] Fix IMP-826: build flow doesn't actually deploy
- [ ] Fix IMP-824: LLM timeout on first ideation
- [ ] Fix IMP-823: "System" label on PO messages
- [ ] Error recovery UI (retry buttons, not just toasts)

## Priority 11 — Production Polish

- [ ] Meta tags + OG for social sharing
- [ ] Deployed app preview iframe
- [ ] Session rename + delete
- [ ] Build progress timeline with real stages

## Process Items

- [x] Require --chrome flag for all UI sprints (enforce in DoR) — enforced since sprint 2
- [x] Discount self-assessed score impact by 25-30% in sprint planning (source: friction, sprint 2) — SUPERSEDED: now 50%
- [x] Discount self-assessed score impact by 40-50% in sprint planning (source: sprint 5 retro) — SUPERSEDED: 50% confirmed calibrated (sprint 7, 8, 9, 10)
- [ ] Document shadcn manual setup pattern for Tailwind v4 projects (source: friction, sprint 1)
- [ ] ACs for opacity should specify minimums, not ban specific values (source: friction, sprint 1)
- [ ] Standardize on Chrome MCP tools over claude-in-chrome for viewport ops (source: friction, sprint 2)
- [ ] DoR: color/contrast stories must include target WCAG contrast ratio with computed RGB values (source: sprint 3 retro)
- [ ] DoD: after judge scoring, if any untouched dimension drops >0.5, add regression-fix item (source: sprint 3 retro)
- [ ] DoR: every UI story must include file path, line number, and exact current code snippet (source: sprint 4 retro)
- [ ] DoR: content stories must specify data source (API endpoint, hardcoded, or placeholder) and copy text (source: sprint 4 retro)
- [ ] DoD: animation/transition stories must verify rendering with screenshot or DevTools (source: sprint 4 retro)
- [ ] WoW: each sprint must address the lowest-scoring dimension first (source: sprint 4 retro)
- [ ] Sprint size: 4-5 stories, no L stories (source: sprint 4 retro)
- [ ] DoD: mobile stories verified via DevTools device emulation, not window resize or code review (source: sprint 5 retro)
- [ ] DoD: hover state stories must include before/after screenshot showing visible difference (source: sprint 5 retro)
- [ ] DoR: social proof content must specify minimum display threshold + adversarial reading (source: sprint 5 retro)
- [ ] WoW: when judge changes, treat all scores as fresh baseline (source: sprint 5 retro)
- [ ] **DoD: hover stories require production computed-style verification in DevTools** (source: sprint 6 retro — PI-1)
- [ ] **DoR: hover stories MUST use named Tailwind colors — opacity fractions permanently banned for light backgrounds** (source: sprint 6 PI-2, upgraded sprint 7 PI-1)
- [ ] **DoR: hover stories must specify all 5 components — named bg + named border + shadow + translate lift + transition-all** (source: sprint 7 retro — PI-2)
- [ ] **DoD: mobile verification method must be recorded (DevTools emulation or Playwright, not code review)** (source: sprint 6 retro — PI-5)
- [ ] **WoW: Trust requires 1+ content story per sprint. If Trust < 7.5, require 2.** (source: sprint 6 PI-4, enforced sprint 7, strengthened sprint 8 PI-5)
- [ ] WoW: target max 2 dimensions per sprint for concentrated impact (source: sprint 6 retro — PI-6)
- [ ] **DoD: shadow stories require before/after screenshot showing visible shadow** (source: sprint 7 retro — PI-4)
- [ ] **WoW: 50% CSS discount / 30% content discount — confirmed calibrated across sprints 8, 9, 10** (source: sprint 7 PI-5, refined sprint 8 PI-1, confirmed sprint 10 PI-5)
- [ ] **DoR: grep-based ACs must be pre-run — change table must cover all matches** (source: sprint 8 PI-2)
- [ ] **DoR: shadow stories must specify `shadow-lg` minimum on cream backgrounds** (source: sprint 8 PI-3, upgraded sprint 9 PI-4, confirmed sprint 10)
- [ ] **WoW: nav links must point to real, honest content — rename to match actual destination** (source: sprint 8 PI-4)
- [ ] **DoR: cream-background contrast floor — compute ratio against #FAF8F5. Min 4.5:1 body, 3:1 large, 7:1 critical UI** (source: sprint 9 PI-1)
- [ ] **DoD: P0 re-fixes require visual comparison AC (screenshot diff or DevTools computed-style)** (source: sprint 9 PI-2)
- [ ] **WoW: accept recalibrated baselines — judge methodology corrections are not regressions** (source: sprint 9 PI-3)
- [ ] **WoW: 2x cream multiplier — all visual fixes on cream (#FAF8F5) spec'd at 2x initial strength — PROVEN sprint 10** (source: sprint 9 PI-4, confirmed sprint 10 PI-6)
- [ ] **WoW: three-strike escalation — P0 unfixed 3+ sprints gets 2 alternative approaches + visual verification — PROVEN sprint 10** (source: sprint 9 PI-5, confirmed sprint 10 PI-6)
- [ ] **WoW: mobile structural stories tagged [STRUCTURAL], estimated at 2x CSS effort — PROVEN sprint 11** (source: sprint 10 PI-1, confirmed sprint 11 PI-5)
- [ ] **DoR: mobile stories must verify hamburger menu exists if nav has 3+ items** (source: sprint 10 PI-2) — RESOLVED: hamburger menu implemented sprint 11
- [ ] **DoD: judge score corrections (methodology changes) auto-create regression-fix items at P1** (source: sprint 10 PI-3)
- [ ] **WoW: when lowest dimension is structural, consider dedicating full sprint — PROVEN sprint 11** (source: sprint 10 PI-4, confirmed sprint 11)
- [ ] **DoD: judge evaluation occurs AFTER deploy health check passes** (source: sprint 11 PI-1 — NEW)
- [ ] **DoD: judge contradictions with executor auto-create [DIAGNOSTIC] items at P1** (source: sprint 11 PI-4 — NEW)
- [ ] **WoW: Trust < 7.5 requires 2 content stories minimum — MUST be enforced sprint 12** (source: sprint 11 PI-2 — ENFORCEMENT)
- [ ] **DoR: mobile P0 bugs require visual verification method specified in story AC** (source: sprint 11 PI-3 — NEW)

## Discovered (added by retros)

- [x] CTA disabled state has been "fixed" in Sprint 2 but still measures 1.5:1 contrast — RESOLVED: sprint 10 three-strike approach A (dark fill, white text, ~7:1 contrast)
- [x] Transform-based hover (`-translate-y`, `scale`) is required for visible feedback — RESOLVED: sprint 10 doubled to 2x intensity
- [x] CTA slide-in animation may not be rendering on production — RESOLVED: sprint 5 replaced with custom `@keyframes slide-in-cta`
- [x] **Phantom hover problem: 5 sprints of hover CSS, judges still score "ZERO feedback."** — RESOLVED sprint 7: named colors (`hover:bg-orange-50`) replaced invisible opacity fractions. Interactions +1.0.
- [x] **CSS variable shadow indirection doesn't register with judges** — RESOLVED sprint 8: replaced `shadow-[var(--shadow-sm)]` with direct `shadow-sm`. Visual Polish +1.0.
- [x] **Trust plateau at 5.0 for 3 sprints — immune to CSS-only work** — RESOLVED sprint 8: nav bar + social links = Trust +2.0. Content stories are essential.
- [x] **Card rest-state shadows: shadow-md ALSO invisible on cream. Need shadow-lg minimum.** — RESOLVED sprint 10: shadow-lg on all cards. Judge confirmed "elevated surfaces."
- [x] **CTA always-visible disabled > progressive reveal — but contrast must be dramatically strong on cream. Three attempts (stone-200, stone-300) all invisible.** — RESOLVED sprint 10: stone-500 bg + white text (~7:1 contrast). Three-strike protocol worked.
- [x] **Focus ring invisibility: ring-primary/20 invisible on cream.** — RESOLVED sprint 10: ring-orange-300 + ring-2. Named color + doubled width.
- [ ] Contrast effect: improving one dimension raises the bar for adjacent ones — plan sprints to target clusters (source: sprint 2, confirmed sprint 3, 5)
- [ ] Positive contrast effect also exists: cross-cutting fixes lift neighboring dimensions (source: sprint 4)
- [ ] Sprint 1 interaction score (6.0) was likely inflated by non-independent assessment — true baseline closer to 4.0-4.5 (source: sprint 2, confirmed sprint 5)
- [ ] Trust/credibility items that need content must be estimated differently from CSS tasks (source: sprint 2, confirmed sprint 8 — 30% vs 50% discount)
- [ ] Three dimensions regressed in each of sprints 2, 3, and 5 despite not being touched — but sprints 4, 6, 7, 8, 9, 10, 11 achieved zero regressions with additive-only changes (source: sprint 3, updated sprint 11)
- [ ] Progressive disclosure > styled disabled state — hide broken/disabled things entirely (source: sprint 4) — BUT: sprint 7 showed always-visible disabled CTA rated "best interaction" — context matters
- [ ] Low social proof numbers are anti-proof — "6 apps built" hurts more than showing nothing (source: sprint 5, confirmed sprint 6)
- [ ] Judge calibration variance is ~1.5 points per dimension — use 3-sprint rolling average (source: sprint 5)
- [ ] Code review of responsive classes ≠ visual verification — 5 sprints of "classes confirmed" produced stable mobile score but methodology is untested (source: sprint 5, updated sprint 10 — CONFIRMED: mobile 7.5 was wrong, no hamburger menu exists)
- [ ] **Additive-only CSS changes prevent regressions — confirmed by sprints 4, 5, 6, 7, 8, 9, 10, 11 (8 consecutive)** (source: sprint 6, updated sprint 11)
- [ ] **Testing methodology changes (window resize vs DevTools emulation) look like regressions in score data — sprint 5 mobile 3.0 was a testing artifact, not code regression** (source: sprint 6)
- [ ] **Section dividers are highest ROI per line of code — single `<hr>` earned +1.0 on Layout** (source: sprint 6)
- [ ] **Named Tailwind colors solve phantom hover — `hover:bg-primary/5` is invisible on cream. `hover:bg-orange-50` = visible. Alpha compositing limit on near-white.** (source: sprint 7)
- [ ] **Complete hover recipe: named bg + named border + shadow-md + translate-y lift + transition-all. Partial sets don't register.** (source: sprint 7, confirmed sprint 8 — hover rated "excellent")
- [ ] **`meta color-scheme="light only"` — one-line fix for dark-mode contamination on light-only pages** (source: sprint 7)
- [ ] **Nav bar is highest-ROI trust item in the epic — one component turned "landing page" into "product". Misleading link destinations now fixed.** (source: sprint 8, updated sprint 9)
- [ ] **Structural content has ~2x the score impact of CSS. Content stories deliver triple impact (target dimension + adjacent dimensions + mobile).** (source: sprint 8, confirmed sprint 9 — HOW IT WORKS improved Trust + Mobile)
- [ ] **Gradient text contrast: endpoints on cream need darker values than on white. #81B29A ≈ 3.5:1, #5B9A7F ≈ 3.8:1 — both borderline. Need #4A8A6E or darker for 4.5:1+.** (source: sprint 8, updated sprint 9)
- [ ] **Judge recalibration from code-reading to visual-testing can drop scores -1.0 per dimension without any code changes. This is a measurement correction, not a regression.** (source: sprint 9)
- [ ] **Phantom fix pattern: CSS changes deployed and verified in code, but visual output insufficient on cream. stone-300 bg, shadow-md, #5B9A7F all "done" but invisible. Cream absorbs all subtle contrast. 2x multiplier needed.** (source: sprint 9, RESOLVED sprint 10 — 2x multiplier eliminated all phantom fixes)
- [ ] **Content stories yield cross-dimensional gains: HOW IT WORKS section improved Trust (P0 fix) AND Mobile (+0.5) from a single story. CSS stories rarely cross dimensions.** (source: sprint 9)
- [ ] **2x cream multiplier is proven: all 5 sprint 10 fixes used 2x strength, all 5 landed visually. Zero phantom fixes. Formalize as standard WoW.** (source: sprint 10)
- [ ] **Three-strike escalation is proven: CTA disabled state resolved after 3 sprints via alternative approaches. Formalize as standard WoW.** (source: sprint 10)
- [ ] **Mobile score correction: sprint 9's 7.5 was wrong (no hamburger menu). Code review ≠ visual verification for structural elements. Score corrections are ±1.0 magnitude.** (source: sprint 10)
- [ ] **Form UX at 8.5 is the first 8+ dimension. Progressive disclosure + domain tag preview + live counters = genuine competitive advantage over Lovable.** (source: sprint 10)
- [ ] **Session card titles are "database leaks" — raw prompts truncated mid-sentence ("that", "where"). Need appName or smart truncation. Data/logic fix, not CSS.** (source: sprint 10)
- [ ] **Gap to Lovable: -1.9 overall (updated sprint 11). Largest: Trust -3.0, Interactions -2.5. Smallest: Form UX 0.0, Layout -1.0. Clowder wins on: zero signup, AI team preview, warm brand personality, mobile form-first.** (source: sprint 10, updated sprint 11)
- [ ] **CSS `order-` requires flex parent. Tailwind `space-y-*` generates margin, not flex. Must convert to `flex flex-col gap-*` before order classes work.** (source: sprint 11 — NEW)
- [ ] **`grayscale` + `opacity` are CSS-transitionable — enables smooth disabled-to-enabled CTA morph without JS.** (source: sprint 11 — NEW)
- [ ] **Hamburger menu simpler than estimated — `useState` + `max-h` transition sufficient. No click-outside or body scroll lock needed for simple nav.** (source: sprint 11 — NEW)
- [ ] **Trust recalibration -0.5 on closer Lovable comparison. Single community card + raw-prompt session titles HURT trust. Anti-patterns: showing one showcase highlights emptiness, showing raw prompts looks like test data.** (source: sprint 11 — NEW)
- [ ] **Clowder's defensible advantages over Lovable: zero signup, AI team preview (unique), expert transparency, template one-click fill, mobile form-first, warm personality. Protect these.** (source: sprint 11 — NEW)
- [ ] **Judge/executor contradictions: sprint 11 S4 nav hover deployed but judge says "NOT FIXED". Process gap — need resolution protocol.** (source: sprint 11 — NEW)
- [ ] **Desktop scores freeze during mobile-only sprints. Expected and correct — focused sprints shouldn't accidentally move other dimensions.** (source: sprint 11 — NEW)

---

## Sprint 12 Recommended Focus

**Trust (6.5) + Interactions (7.0) — the two lowest dimensions.**

Trust requires content; Interactions requires animations. Sprint 12 should be a **mixed content + animation sprint**. WoW rule: Trust < 7.5 requires 2 content stories.

**Candidate stories:**
1. **[P0] Mobile textarea text overlap** (XS) — quick fix, clears the only P0
2. **[CONTENT] Social proof section** (M) — "X apps built" counter + showcase. Trust +0.5 estimated
3. **[CONTENT] Fix session card titles** (S) — appName or smart truncation. Trust + Typography cross-lift
4. **Entrance animations** (M) — hero stagger fade-in. Interactions + Visual cross-lift
5. **[DIAGNOSTIC] Verify nav hover on production** (XS) — resolve judge discrepancy

**Expected (50% discount):** Trust 6.5 → 7.0, Interactions 7.0 → 7.3, Overall 7.3 → 7.5
**Sprint type:** 2 content + 1 animation + 1 bugfix + 1 diagnostic
**Risk:** Content stories require real data (Data API calls, actual delivered apps). If delivered app count < 3, COMMUNITY expansion may be blocked.
