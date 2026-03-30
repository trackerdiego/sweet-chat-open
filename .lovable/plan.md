

# Plan: Copy Aura OS Project to This Project

## Overview
Copy the entire "Aura OS" (Influlab) codebase into this project, including all components, pages, hooks, data, assets, edge functions, migrations, and configurations. This is a comprehensive Influlab platform with authentication, onboarding, AI chat, script generation, task management, and PWA support.

## What Will Be Copied

### Configuration Files (~8 files)
- `package.json` - merge new dependencies (framer-motion, react-markdown, canvas-confetti, @ffmpeg/ffmpeg, @ffmpeg/util, @tailwindcss/typography, react-resizable-panels)
- `index.html` - Influlab metadata, manifest link, favicon
- `tailwind.config.ts` - custom fonts, colors (gold, sand, charcoal, ai-from/ai-to), animations (pulse-gold, shimmer)
- `src/index.css` - Influlab design system with purple/violet palette, glass-card components, gradient utilities
- `src/main.tsx` - service worker registration
- `src/App.tsx` - full routing with auth guards, onboarding flow, navigation
- `public/manifest.json` - PWA manifest
- `public/sw-push.js` - push notification service worker

### Pages (11 files)
- `Index.tsx`, `Landing.tsx`, `Auth.tsx`, `ResetPassword.tsx`, `Onboarding.tsx`, `Matrix.tsx`, `Script.tsx`, `Tasks.tsx`, `Tools.tsx`, `Admin.tsx`, `NotFound.tsx`

### Components (~22 files)
- Core: `Navigation.tsx`, `InstallBanner.tsx`, `AiChat.tsx`, `CheckoutModal.tsx`, `DailyGuide.tsx`, `DailySchedule.tsx`, `DayDetailCard.tsx`, `MindsetPulse.tsx`, `MonthlyProgress.tsx`, `NicheIcon.tsx`, `PremiumGate.tsx`, `PushNotificationButton.tsx`, `Rifometro.tsx`, `ScriptGenerator.tsx`, `StreakCounter.tsx`, `TaskChecklist.tsx`, `WeeklyView.tsx`, `NavLink.tsx`
- Landing: `FeatureBar.tsx`, `HeroMockup.tsx`
- UI components remain (already present, will update if different)

### Hooks (8 custom files)
- `useInfluencer.ts`, `useInstallPrompt.ts`, `useLocalStorage.ts`, `usePushNotifications.ts`, `useUserProfile.ts`, `useUserProgress.ts`, `useUserStrategies.ts`, `useUserUsage.ts`

### Data (4 files)
- `dailyGuideContent.ts`, `dailySchedule.ts`, `quotes.ts`, `strategies.ts`

### Assets (~16 image files)
- Logos: `influlab-logo.png`, `influlab-logo-horizontal.png`, `auth-bg.png`, `hero-illustration.png`
- Niche icons: 11 PNG files (beleza, culinaria, educacao, fitness, etc.)
- Public: `favicon.ico`, `favicon.png`, `og-image.png`, `icons/icon-192.png`, `icons/icon-512.png`

### Supabase Edge Functions (14 functions)
- `_shared/email-templates/` (6 template files)
- `ai-chat/`, `generate-script/`, `generate-personalized-matrix/`, `generate-audience-profile/`, `generate-daily-guide/`, `generate-tools-content/`, `transcribe-media/`, `admin-dashboard/`, `auth-email-hook/`, `create-asaas-subscription/`, `process-email-queue/`, `scheduled-push/`, `send-push/`

### Supabase Migrations (17 SQL files)
- All migration files for database schema

### Supabase Types
- `src/integrations/supabase/types.ts` - updated with all table definitions
- `src/integrations/supabase/client.ts` - keep current project's Supabase credentials

## Important Notes
- **Supabase credentials**: Will keep THIS project's Supabase URL and keys (not copy from Aura OS)
- **Migrations**: Will be copied but need to be applied to this project's Supabase instance
- **Edge functions**: Will be copied and need deployment to this project's Supabase
- **Assets**: Image files will be copied using cross_project--copy_project_asset

## Implementation Order
1. Update config files (package.json, tailwind, index.html, CSS)
2. Copy all data files and hooks
3. Copy all components (landing, core, UI updates)
4. Copy all pages
5. Update App.tsx and main.tsx with routing and service worker
6. Copy all public assets (icons, manifest, favicon, service worker)
7. Copy all src/assets (logos, niche images)
8. Copy Supabase types (keep current credentials)
9. Copy all migrations
10. Copy all edge functions and email templates

