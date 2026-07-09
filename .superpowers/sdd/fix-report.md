# Fix Report: Branch Review Findings

**Date**: 2026-07-07
**Branch**: `develop`
**Source**: `.superpowers/sdd/branch-review-report.md`

---

## Summary

All 4 findings from the branch review were fixed across 4 commits. TypeScript check (`npx tsc --noEmit`) passes cleanly with zero errors.

---

## Fixed Findings

### Fix 1 (HIGH): SplashScreen center glow not shown on touch devices

**Commit**: `d834774` — `fix: show SplashScreen center glow on touch devices without hover capability`

**File**: `frontend/src/components/auth/SplashScreen.tsx`

**What was done**:
- Added `isTouchDevice` detection via `window.matchMedia('(hover: none)')`
- Added `showCenterGlow` as `prefersReducedMotion || isTouchDevice`
- Changed the center glow div condition from `{prefersReducedMotion &&` to `{showCenterGlow &&`
- Ripple rendering and parallax remain gated on `prefersReducedMotion` only (unchanged)

**Verification**: On touch devices without reduced motion, the center glow now shows. On desktop with reduced motion, glow still shows. On desktop without reduced motion, ripples appear on mouse move (no glow).

---

### Fix 2 (MEDIUM): LoginForm loading/error states overflow inside LoginLayout

**Commit**: `a114898` — `fix: remove min-h-screen from LoginForm early-return states to prevent overflow inside LoginLayout`

**File**: `frontend/src/components/auth/LoginForm.tsx`

**What was done**:
- Loading spinner early return (line 205): removed `min-h-screen`, now `className="flex items-center justify-center"`
- Connection error early return (line 214): removed `min-h-screen`, now `className="flex items-center justify-center bg-background p-4"`

**Verification**: Both early-return states now fit within LoginLayout's `flex-1 p-4` right panel without vertical overflow.

---

### Fix 3 (LOW): FlipTransition unused `useRef` import

**Commit**: `900834c` — `fix: remove unused useRef import from FlipTransition`

**File**: `frontend/src/components/auth/FlipTransition.tsx`

**What was done**:
- Removed `useRef` from the React import on line 3
- Changed from `import { useEffect, useRef, useState, type ReactNode } from 'react'` to `import { useEffect, useState, type ReactNode } from 'react'`

**Verification**: `useRef` is never called in the component body; TypeScript confirms no errors.

---

### Fix 4 (LOW): SplashScreen missing resize handler

**Commit**: `722eb56` — `fix: add resize handler to clear SplashScreen ripple buffer on window resize`

**File**: `frontend/src/components/auth/SplashScreen.tsx`

**What was done**:
- Added `useEffect` to React import
- Added `useEffect` that registers a `resize` event listener calling `setRipples(Array(8).fill(null))`
- Event listener is properly cleaned up on unmount

**Verification**: On window resize, all ripple positions are cleared, preventing stale offset ripples.

---

## TypeScript Check

```
cd frontend && npx tsc --noEmit
```

Result: **Pass with zero errors.**

---

## Commit History

```
722eb56 fix: add resize handler to clear SplashScreen ripple buffer on window resize
d834774 fix: show SplashScreen center glow on touch devices without hover capability
a114898 fix: remove min-h-screen from LoginForm early-return states to prevent overflow inside LoginLayout
900834c fix: remove unused useRef import from FlipTransition
2702805 feat: implement splash-to-login phase state machine on /login route
```

---

## Not Addressed (Deferred)

The following findings from the review report were **not** in scope for this fix batch:

- **Finding 3 (MEDIUM)**: `prefersReducedMotion` hydration mismatch pattern (FlashOverlay, FlipTransition, SplashScreen) — requires broader architectural decision on SSR hydration strategy
- **Finding 4 (MEDIUM)**: LoginForm hardcoded Tailwind colors for error/success messages — needs new CSS variable or i18n-aware color tokens
- **Finding 6 (LOW)**: `requestAnimationFrame` cleanup on unmount in SplashScreen — React 18 silently ignores, but best-practice cleanup deferred
- **Finding 8 (LOW)**: Hardcoded strings bypassing i18n in LoginForm — needs new i18n keys added to locale files
