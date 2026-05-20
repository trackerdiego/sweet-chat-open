Replace all occurrences of "VyralLab" (without space) with "Vyral Lab" (with space) in three files.

Files and lines:
1. `supabase/functions/scheduled-push/index.ts`
   - Line 28: body string in `morning` array
   - Line 35: body string in `morning` array
   - Line 93: body string in `FREE_EARLY.morning` array
   - Line 256: body string in `FREE_INACTIVE` array
   - Line 275: body string in `FREE_INACTIVE.evening` array
   - Line 285: title string in `NEW_USER.morning` array
   - Line 303: body string in `NEW_USER.evening` array

2. `supabase/functions/notify-pix-due-soon/index.ts`
   - Line 62: body string in `D3` array
   - Line 65: body string in `D1` array
   - Line 75: body string in `DP1` array

3. `public/sw-push.js`
   - Line 49: default title in push event listener
   - Line 60: fallback title in showNotification call

Total: 10 replacements. No other logic changes.