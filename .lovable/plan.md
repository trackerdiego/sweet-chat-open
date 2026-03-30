

# Plan: Fix Build Errors - Create Missing Files & Fix TypeScript

## Overview
The build has 30+ errors from two categories: (1) missing files (9 pages + dailySchedule.ts) and (2) TypeScript errors from Supabase types not knowing about tables. All source content has been read from the Aura OS project.

## Steps

### 1. Create `src/data/dailySchedule.ts`
Full 584-line file with schedule generation logic, weekly themes, cliffhangers, and contextual descriptions per pillar.

### 2. Create all 9 missing pages
- `src/pages/Landing.tsx` - Full landing page with hero, features, pricing, FAQ
- `src/pages/Auth.tsx` - Login/signup with forgot password flow
- `src/pages/Onboarding.tsx` - 3-step onboarding with AI pipeline
- `src/pages/Matrix.tsx` - 30-day strategy matrix grid
- `src/pages/Script.tsx` - Script generator page
- `src/pages/Tasks.tsx` - Daily tasks with schedule and guide
- `src/pages/Tools.tsx` - AI tools page with transcription
- `src/pages/Admin.tsx` - Admin dashboard
- `src/pages/ResetPassword.tsx` - Password reset flow
- `src/pages/NotFound.tsx` - Already exists, will update if needed

### 3. Fix Supabase TypeScript errors in hooks
Add `as any` casts to all Supabase `.from()` calls in:
- `useUserProfile.ts` - 3 `.from('user_profiles')` calls
- `useUserProgress.ts` - 4 `.from('user_progress')` calls + property access casts
- `useUserUsage.ts` - 3 `.from('user_usage')` calls
- `useUserStrategies.ts` - 1 `.from('user_strategies')` call

This is necessary because the Supabase types file has no table definitions yet (tables haven't been created via migrations).

## Technical Notes
- Pages reference assets like `@/assets/influlab-logo.png` which don't exist yet — these will need to be copied in a subsequent step (assets migration)
- The `as any` pattern on Supabase calls is temporary until migrations create the actual tables
- The `date-fns` and `framer-motion` dependencies were already added in previous steps

