# Task 3 Report: SplashScreen Component

## Status: Completed

## Commit

- **Hash**: `8fe3f6f`
- **Message**: `feat: add SplashScreen with mouse ripple and parallax`

## TypeScript Check

- **Result**: Passed clean (no errors, no warnings)
- **Command**: `cd frontend && npx tsc --noEmit`

## File Created

- `frontend/src/components/auth/SplashScreen.tsx` (129 lines)

## Component Summary

The `SplashScreen` component is the interactive entry point for EduLoom's `/login` page. Users see a full-viewport dark gradient background with the "EduLoom" brand text and subtitle. Clicking anywhere triggers the parent's `onClick` callback to transition to the login form.

### Features Implemented

1. **Mouse-tracking ripple effects**: 8-slot ring buffer of circular ripples that spawn at the cursor position on `mousemove`, then fade out and scale up over 800ms via CSS transitions.

2. **Parallax text shift**: The brand text and subtitle shift up to +/-5px based on normalized mouse position (0-1 range), creating a subtle depth effect.

3. **Accessibility**: Respects `prefers-reduced-motion: reduce` — disables ripples and parallax, shows a static pulsing center glow instead.

4. **Performance**: Uses `requestAnimationFrame` for ripple state updates, refs for slot/index counters to avoid unnecessary re-renders.
