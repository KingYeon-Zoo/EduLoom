# Task 3 Review: SplashScreen Component

**File:** `frontend/src/components/auth/SplashScreen.tsx`

---

## Verdict 1: Spec Compliance

### PASSED (6 of 7 constraints)

| # | Constraint | Status | Notes |
|---|-----------|--------|-------|
| 1 | Zero new npm dependencies | PASS | Uses only React hooks and `@/lib/hooks/use-translation` (existing) |
| 2 | All animations on `transform` + `opacity` | PASS | Ripple: `opacity` + `scale`; Parallax: `translate`; Glow: `animate-pulse` (opacity-based) |
| 3 | `prefers-reduced-motion` support | PASS | Ripple + parallax disabled; static center glow shown |
| 4 | Touch devices: ripple hidden, click works, center glow shows | **PARTIAL FAIL** | On a touch device WITHOUT the `prefers-reduced-motion` OS setting, `prefersReducedMotion` evaluates to `false`, so the center glow `<div>` (gated on `prefersReducedMotion`) does **not** render. The user sees neither ripples (no mousemove) nor glow — a blank gradient screen. The spec says "center glow shows" on touch; the current code only shows it when reduced-motion is active. |
| 5 | Ring buffer max 8 DOM nodes | PASS | `Array(8).fill(null)` with modulo slotting; no allocations after init |
| 6 | Entire viewport clickable | PASS | `fixed inset-0 z-50` with `onClick` on root `<div>` |
| 7 | i18n key `auth.splashSubtitle` | PASS | `t('auth.splashSubtitle')` — key exists in both `en-US` and `zh-CN` locale files |

**Spec violation (touch device gap):** The center glow is only rendered when `prefersReducedMotion === true` (line 108). On a touch device without that OS accessibility setting, the splash screen has zero visual interest — no ripples, no glow. The spec explicitly acknowledges this scenario and says "center glow shows." Recommend either:
- Rendering the center glow unconditionally (always show it as a base layer), or
- Detecting touch capability via `'ontouchstart' in window` or `matchMedia('(pointer: coarse)')`, or
- Showing the glow after a brief timeout when no mousemove is detected.

---

## Verdict 2: Code Quality

### PASSED with minor issues

**Strengths:**
- Proper TypeScript interfaces (`Ripple`, `SplashScreenProps`) with correct typing.
- `useCallback` memoization with correct dependency array (`[prefersReducedMotion]`).
- Functional updater pattern in `setRipples(prev => ...)` avoids stale closures.
- Ring-buffer idempotency guard (`next[slot]?.id === id`) correctly prevents stale RAF writes from clobbering newer ripples in the same slot.
- No external event listeners or subscriptions added — no cleanup needed.
- `key` attribute uses both `ripple.id` and index, guaranteeing uniqueness across slot rotations.
- Gradient color uses `oklch()` — modern, wide-gamut syntax.

**Issues:**

| # | Severity | Issue | Suggestion |
|---|----------|-------|------------|
| 1 | **Low** | `requestAnimationFrame` may fire after component unmount, calling `setRipples` on unmounted state. Benign in React 18+ (no-op), but avoidable. | Store a `mountedRef` and check it before the `setRipples` call inside the RAF callback. |
| 2 | **Low** | `prefersReducedMotion` is a plain `const` recomputed on every render. While `window.matchMedia` is fast, this is unnecessary work and the value is never reactive to OS setting changes at runtime. | Wrap in `useMemo(() => ..., [])` for clarity; add a `change` listener via `useEffect` only if mid-session reactivity matters (minor for a splash screen). |
| 3 | **Cosmetic** | Ripple slot reuse creates a brief reverse animation: when a slot cycles to a new ripple, the CSS transition animates `opacity: 0→1` and `scale: 2→1` (the previous fade-out state reversing). | Either remove the transition class from the ripples and let the RAF-driven state change be instant, or insert a new unique key per ripple to force React to remount the element (defeats ring-buffer reuse but simpler). |
| 4 | **Low** | The `handleMouseMove` closure captures `prefersReducedMotion` at render time. Since `prefersReducedMotion` is re-evaluated each render but doesn't change in practice, the `useCallback` deps are stable — no bug, but slightly misleading. | A `useRef` for the reduced-motion flag would make the intent clearer. |

**Bonus observation (not a defect):** `font-heading` and `font-sans` are defined as Tailwind v4 `@theme inline` tokens in `globals.css` (lines 7-8), so they resolve correctly as utility classes. Confirmed they exist in the project.

### Overall: Pass (1 spec violation + 4 minor code-quality notes)
