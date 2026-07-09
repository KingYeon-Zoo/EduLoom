# Task 6 Review: LoginLayout

## Verdict: PASS

All five constraints are satisfied. Details below.

---

### Constraint 1: Flex layout — left `flex-[2]`, right `flex-1`, `min-h-screen`

**PASS.** The outer div uses `flex min-h-screen`. The left panel applies `flex-[2]` and the right panel applies `flex-1`, matching the spec exactly.

### Constraint 2: Left panel — hidden < md, dark gradient, 2 ambient glow orbs (6s/8s), BrandIllustration, i18n slogan

**PASS.**
- `hidden md:flex` correctly hides the panel on screens smaller than `md`.
- Gradient `bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950` is a dark gradient.
- Two glow orbs present: first at `-top-[10%] -left-[10%]` with `bg-indigo-500/10` and `animationDuration: '6s'`; second at `-bottom-[5%] -right-[10%]` with `bg-violet-500/8` and `animationDuration: '8s'`. The `/8` opacity is a valid Tailwind arbitrary value (8%).
- `<BrandIllustration />` is rendered in the content area.
- `{t('auth.brandSlogan')}` renders the i18n slogan with the `useTranslation` hook.

### Constraint 3: Right panel — `bg-background`, centered children, `max-w-sm`

**PASS.**
- `bg-background` uses the shadcn/ui CSS variable.
- `flex items-center justify-center` centers the children vertically and horizontally.
- The inner wrapper uses `w-full max-w-sm`.

### Constraint 4: Uses i18n key `auth.brandSlogan` from Task 1

**PASS.** The key `auth.brandSlogan` is referenced as `t('auth.brandSlogan')` and exists in both locale files:
- `frontend/src/lib/locales/en-US/index.ts` (line 231): `"Your AI-powered research companion"`
- `frontend/src/lib/locales/zh-CN/index.ts` (line 231): `"你的 AI 智能研究助手"`

### Constraint 5: Uses BrandIllustration from Task 2

**PASS.** The component is imported via `import { BrandIllustration } from './BrandIllustration'` and the target file exists at `frontend/src/components/auth/BrandIllustration.tsx`.

---

## Additional Observations

- The file uses `'use client'` directive, required because it uses the `useTranslation` hook and client-side rendering.
- TypeScript interface `LoginLayoutProps` with `ReactNode` children is properly typed.
- The implementation is clean, well-commented, and follows the project's conventions (named exports, `@/` path alias, Tailwind utility classes).
