# Task 4 Review: FlashOverlay

## Spec Compliance Verdict: PASS (with notes)

| Requirement | Status | Notes |
|---|---|---|
| `onComplete` prop, called after 300ms (150ms with reduced motion) | PASS | `duration` correctly computed; `setTimeout(onComplete, duration)` in effect |
| White fullscreen overlay, z-50 | PASS | `className="fixed inset-0 z-50 bg-white"` |
| Starts opacity:0 / scale:0.95 | PASS | Inline `style={{ opacity: 0, transform: 'scale(0.95)' }}` (or `'none'` for reduced motion) |
| Animates to opacity:1 / scale:1 | PASS | RAF sets both; scale skipped for reduced motion |
| RAF triggers enter animation | PASS | `requestAnimationFrame` callback sets final opacity/transform |
| `setTimeout` triggers `onComplete` | PASS | `setTimeout(onComplete, duration)` |
| Cleanup clears timeout on unmount | PASS | `return () => clearTimeout(timer)` |
| Reduced-motion branch (150ms, no scale) | PASS | `duration = 150`, initial `transform: 'none'`, RAF skips scale |

All spec requirements are satisfied.

---

## Code Quality Verdict: CONDITIONAL PASS (2 findings)

### Finding 1 (medium): Hydration mismatch risk

`prefersReducedMotion` is computed at render time using `window.matchMedia(...)`. In a `'use client'` component, Next.js still server-renders the initial HTML. On the server `window` is undefined, so `prefersReducedMotion` defaults to `false`. This means:

- **Server HTML**: `transform: scale(0.95)`, `transition: all 300ms ease-out`
- **Client (if user prefers reduced motion)**: `transform: none`, `transition: all 150ms ease-out`

React will emit a hydration mismatch warning and may re-render, causing a brief flash of the wrong styles. Since the overlay quickly covers the screen and animates in, the visual impact is minimal, but the warning is avoidable.

**Suggestion**: Move `prefersReducedMotion` into a `useSyncExternalStore` or `useState` + `useEffect` pattern so the server and client first render agree, then update after hydration:

```tsx
const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

useEffect(() => {
  setPrefersReducedMotion(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}, [])
```

Alternatively, suppress the aspect-ratio discrepancy by always rendering the initial style with the server-safe values and only updating styles after hydration. Given that this is a transient overlay, accepting the warning may be acceptable.

### Finding 2 (low): Variable naming clarity

The timeout identifier is named `timer`, which is ambiguous (could be an interval or RAF id). `timeoutId` or simply `id` would be more idiomatic for `setTimeout`.

```diff
- const timer = setTimeout(onComplete, duration)
+ const id = setTimeout(onComplete, duration)
  return () => clearTimeout(timer)
```

Trivial, but consistency matters in a shared codebase.

---

## Summary

**Spec compliance is complete.** The code is concise, correctly handles cleanup, and branches properly for reduced motion. The only actionable item is the hydration mismatch risk (Finding 1), which is worth fixing if the project avoids console warnings. Finding 2 is a style nit.
