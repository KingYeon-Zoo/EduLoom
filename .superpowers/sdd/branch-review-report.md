# Branch Review Report: Login Splash Redesign

**Date**: 2026-07-07
**Branch**: `develop`
**Spec**: `docs/superpowers/specs/2026-07-07-login-splash-design.md`

---

## Summary

The login splash redesign introduces a four-phase state machine (splash -> flash -> flip -> login) with interactive ripple effects, a flash overlay, a 3D page-flip transition, and a two-column login layout. The implementation is mostly solid: the phase state machine is correct, component contracts are well-defined, CSS theme variables from globals.css are used consistently for card/background/border tokens, and the two i18n keys (`auth.splashSubtitle`, `auth.brandSlogan`) are correctly wired. No infinite loops, no stuck states, and no missing dependencies.

However, the review found **one high-severity spec-compliance gap**, **three medium integration issues** from the cross-task refactoring, and **four low-severity cleanup items**.

---

## Findings

### 1. HIGH -- SplashScreen center glow incorrectly gated on `prefersReducedMotion`

**File**: `frontend/src/components/auth/SplashScreen.tsx`, line 102
**Summary**: The spec (section 3.1.4) requires a static center glow on touch devices without hover; the code gates it on `prefersReducedMotion` instead, leaving touch devices without reduced-motion with no visual feedback at all.

**Details**:
- Spec requirement: "No mouse devices (touch): No ripple effects, show a single static breathing glow at center, touch/click still triggers transition"
- Code: `{prefersReducedMotion && (<div ... className="...animate-pulse" />)}`
- On a touch device (e.g., iPad) where `prefersReducedMotion` is `false`, both conditions fail: ripples don't appear (no `mousemove` events), and the center glow doesn't appear (gated on `prefersReducedMotion`).
- The result is a dark screen with just text -- no interactive feedback.

**Recommendation**: Decouple the two conditions. Use a media query for `(hover: none)` or detect the absence of `mousemove` events over a short timeout to enable the center glow independently of `prefersReducedMotion`. The center glow should appear when EITHER `prefersReducedMotion` is true OR the device has no hover capability.

---

### 2. MEDIUM -- LoginForm connection-error and loading states overflow inside LoginLayout

**File**: `frontend/src/components/auth/LoginForm.tsx`, lines 204-207 and 212-254
**Summary**: The loading spinner and connection-error early-return states render with `min-h-screen` wrappers, but LoginForm is now a child of LoginLayout's right panel, which is a flex child with `p-4` padding. The `min-h-screen` inner div exceeds the available height by 32px, causing vertical overflow and scrollbars.

**Details**:
- Old architecture: `LoginForm` was the page root component; `min-h-screen` was correct.
- New architecture: `LoginPage -> LoginLayout (flex min-h-screen) -> right panel (flex-1, p-4) -> LoginForm`.
- The `min-h-screen` (100vh) child inside a parent container with 16px vertical padding (32px total) overflows by 32px.
- On mobile (`< md`): the right panel becomes full-screen, same overflow applies.
- This is a cross-task integration issue: the LoginForm refactor to use CSS theme variables (Task 7) removed the outer `min-h-screen` wrapper from the normal return path but did not update the two early-return paths.

**Recommendation**: Replace `min-h-screen` with `h-full` or `min-h-full` in the loading and connection-error early returns, or wrap them so they fill their parent container rather than forcing viewport height.

---

### 3. MEDIUM -- `prefersReducedMotion` computed at render scope risks hydration mismatch

**File**: `frontend/src/components/auth/FlashOverlay.tsx`, lines 12-15 (same pattern in `FlipTransition.tsx` lines 13-16 and `SplashScreen.tsx` lines 26-29)
**Summary**: `prefersReducedMotion` is resolved via `window.matchMedia()` at component render scope (not inside `useEffect`). Next.js pre-renders client components on the server where `window` is undefined, always yielding `false`. On client hydration, if the user has `prefers-reduced-motion: reduce`, the computed value changes from `false` to `true`, creating a style mismatch between the server-rendered HTML and the client hydration.

**Details**:
- Server render: `typeof window === 'undefined'` -> `prefersReducedMotion = false` -> `duration = 300ms`, `transform: 'scale(0.95)'` (FlashOverlay)
- Client hydration (with reduced motion): `prefersReducedMotion = true` -> `duration = 150ms`, `transform: 'none'`
- The FlashOverlay starts with `opacity: 0`, so the visual impact is negligible (the mismatch happens while invisible).
- However, React may log a hydration warning in development mode, and the pattern is fragile.

**Recommendation**: Initialize `prefersReducedMotion` to a safe default (`false`), then update it in a `useEffect` after mount, or use a `useState` + `useEffect` pattern. The FlashOverlay could also defer its initial render until after mount to avoid any mismatch.

---

### 4. MEDIUM -- LoginForm error/success colors use hardcoded Tailwind values instead of CSS theme variables

**File**: `frontend/src/components/auth/LoginForm.tsx`, lines 372 and 380
**Summary**: The error message block uses `text-rose-500` / `bg-rose-500/10` and the success message uses `text-emerald-400` / `bg-emerald-500/10`. These hardcoded colors do not adapt to the CSS theme and may have poor contrast in dark mode.

**Details**:
- Spec section 3.4.3 requires: "卡片使用 CSS 变量主题令牌（bg-card、text-card-foreground、border-border），支持明暗模式"
- The rest of LoginForm correctly uses `bg-background`, `text-foreground`, `text-muted-foreground`, `border-input`, `bg-primary`, `text-primary-foreground`, `bg-card`, `text-card-foreground`.
- The connection error state correctly uses `text-destructive` and `bg-destructive/10` (lines 217, 227).
- But the inline form error/success messages do not. The project's globals.css defines `--destructive` for both `:root` and `.dark`, so `text-destructive` and `bg-destructive/10` would work in both themes.

**Recommendation**: Replace `text-rose-500` with `text-destructive` and `bg-rose-500/10` with `bg-destructive/10` in the error block. For success, either define a CSS variable or ensure `text-emerald-400` has sufficient contrast in dark mode (it does at 400 lightness, but using a variable would be more consistent).

---

### 5. LOW -- `useRef` imported but never used in FlipTransition

**File**: `frontend/src/components/auth/FlipTransition.tsx`, line 3
**Summary**: `useRef` is in the import destructure from React but is never called in the component body. Dead import.

**Recommendation**: Remove `useRef` from the import statement.

---

### 6. LOW -- `requestAnimationFrame` callback in SplashScreen has no cleanup on unmount

**File**: `frontend/src/components/auth/SplashScreen.tsx`, lines 71-79
**Summary**: The `requestAnimationFrame` that fades out ripples has no corresponding `cancelAnimationFrame` in a cleanup function. If the user clicks to transition away from splash before the RAF fires, `setRipples` is called on an unmounted component.

**Details**:
- React 18 silently ignores state updates on unmounted components (no warning, no error).
- The guard `if (next[slot]?.id === id)` additionally prevents stale updates from affecting the wrong ripple.
- Net impact: zero user-visible effect in React 18. Cleanup is best-practice but not blocking.

**Recommendation**: Store the RAF handle in a ref and cancel it in a `useEffect` cleanup, or use a mounted ref to guard the `setRipples` call.

---

### 7. LOW -- Missing window resize handler for ripple buffer cleanup

**File**: `frontend/src/components/auth/SplashScreen.tsx`
**Summary**: Spec section 3.1.4 states: "窗口大小改变时清空涟漪缓冲区，避免残留错位节点" (clear ripple buffer on resize). No `resize` event listener or `ResizeObserver` is implemented.

**Details**:
- Currently, after a window resize, ripples at the old coordinates remain in the buffer until they naturally expire (800ms CSS transition + React re-render).
- The ripple positions would be visually offset from the cursor after resize.
- Impact is temporary (max 800ms) and cosmetic.

**Recommendation**: Add a `resize` event listener that calls `setRipples(Array(8).fill(null))` and resets `nextSlotRef` to 0, with cleanup in the `useEffect` return.

---

### 8. LOW -- Two hardcoded strings in LoginForm bypass the i18n system

**File**: `frontend/src/components/auth/LoginForm.tsx`, lines 172 and 274
**Summary**: The password minimum-length error and the default admin credentials hint use inline `language === 'zh-CN'` ternary checks with hardcoded Chinese/English strings instead of i18n keys.

- Line 172: `'密码长度不能少于 5 位' : 'Password must be at least 5 characters'`
- Line 274: `'系统默认管理员账号为 admin / admin' : 'Default admin account is admin / admin'`

**Recommendation**: Add i18n keys (e.g., `auth.passwordMinLength`, `auth.defaultAdminHint`) to the locale files and use `t()` calls.

---

## Verified Correct

The following aspects were explicitly checked and found to be correct:

- **Phase state machine**: Acyclic, no infinite loops, no stuck states. Each phase has exactly one exit transition.
- **Component contracts**: `SplashScreen.onClick`, `FlashOverlay.onComplete`, `FlipTransition.onComplete`, and `FlipTransition.children`/`LoginLayout.children` all match between producers and consumers.
- **CSS theme variables**: All CSS variables used in LoginForm (`bg-card`, `text-card-foreground`, `border-border`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-input`, `text-primary`, `text-primary-foreground`, `bg-primary`) exist in globals.css for both `:root` and `.dark`.
- **i18n keys**: `auth.splashSubtitle` and `auth.brandSlogan` exist in both `en-US` and `zh-CN` locale files.
- **Responsive left panel**: `hidden md:flex` correctly hides the left brand panel on screens below 768px.
- **Splash gradient**: Matches spec exactly (`bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950` in both SplashScreen and LoginLayout left panel).
- **Ripple slot reuse guard**: The `if (next[slot]?.id === id)` check in the RAF callback correctly prevents stale ripple updates from affecting newer ripples in the same slot. React key changes also cause DOM unmount/remount. No reverse CSS transition issue exists.
- **Rapid-click safety**: Redundant `setPhase('flash')` calls are batched by React 18. After the phase transitions to `flash`, the SplashScreen component (and its click handler) is unmounted.
- **Browser back/forward**: Since all phases share the same `/login` route, back/forward navigation leaves the login page entirely and returns fresh.

---

## Not in Scope / Pre-existing

The following were observed but are part of the broader auth system refactor (registration, token-based auth, captcha), not the splash redesign:

- Backend `api/auth.py` token generation/verification
- Backend `api/routers/auth.py` registration/login/captcha endpoints
- Backend `api/main.py` admin user initialization and middleware changes
- `dev-init.sh` rebranding and SurrealDB port changes
- BMW design analysis documents (not functional code)
- SurrealQL query syntax fixes in `api/routers/sources.py`

These are outside the splash redesign scope and were not reviewed in depth.
