# Project Context: Black Hills Nightlife (BHNL)

## 1. Project Overview & Aesthetic
**BHNL** is a gamified, real-time social networking and nightlife application built specifically for the Rapid City/Black Hills area. It combines event discovery, social feeds, gamification (Lifestyle Points/Shop), an interactive Live Map (Radar), and "KSocial" (a live interactive stage/karaoke management system).
- **Aesthetic:** Deep Dark Mode (`#030712` background). 
- **Accents:** Neon glowing box-shadows (Cyan `#00f5ff`, Purple `#b347ff`, Pink `#ff2d78`).
- **Typography:** `Inter` (sans-serif) for body text; `Bebas Neue` for large headers/titles.
- **Backgrounds:** Uses isolated animated CSS backgrounds (e.g., `Moonshower.jsx`) with `z-[-1]`, `fixed`, and `pointer-events-none`.

## 2. Tech Stack
- **Frontend Framework:** React 19
- **Build Tool:** Vite
- **Routing:** React Router v7 (`react-router-dom`)
- **Styling:** Tailwind CSS v4 (No `tailwind.config.js` - uses `@theme` in `index.css`)
- **Backend/BaaS:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Deployment:** Cloudflare Pages (`@cloudflare/vite-plugin`)

## 3. Environment & Local Development
- **Local Dev Server:** Vite runs on `http://localhost:5173`.
- **Tunneling:** Uses **Ngrok** to expose the local server for mobile testing. Initiated via `START_BHNL.bat` which launches both Vite and Ngrok simultaneously.
- **Cloudflare Caching:** When deploying to production, Cloudflare aggressively caches the app. **CRITICAL:** If CSS/Build errors occur in production, the Cloudflare cache must be manually purged.
- **Environment Variables:** Loaded via `.env.local` / `.env.production` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).

## 4. Application Architecture & Routing
The app is a Single Page Application (SPA) driven by `App.jsx`.
- **Pre-Render Guards:** 1. No Session? Render `<Auth />`
  2. No Onboarding? Render `<Onboarding />`
- **Main Layout:** A static `<TopNav />` and a global animated background (`<Moonshower />`).
- **Routing:** Uses `useSearchParams` (`?tab=`) to lazy-load top-level components (FYP, Map, Live, Shop, Events, Profile) via `<Suspense>`.
- **Entity Viewer Overlay:** If the URL has `?view=profile`, `<PublicProfile />` mounts over the main UI.

## 5. Supabase & Database Schema Context
The app heavily relies on Supabase for data and realtime sync.
- **Core Tables:** `profiles`, `pages` (Venues), `events`, `active_sessions` (KSocial), `session_singers`, `connections` (Friends), `posts`, `post_likes`, `comments`, `notifications`, `shop_items`.
- **Realtime Channels Used:**
  - `realtime-notifs`: Listens for inserts to the `notifications` table for the current user.
  - `public-sessions`: Listens for KSocial stage activations.
  - `public-users-location`: Listens for GPS updates to plot on the Map.
- **RPCs:** Uses Edge Functions like `trigger_reward` to award Lifestyle Points for actions (Daily Login, VibeCode Scans).

## 6. Key Module Logic
- **Global Radar Sweep (`App.jsx`):** Uses native HTML5 `navigator.geolocation.watchPosition` with a 60-second throttle to update `current_lat` and `current_lng` in the `profiles` table.
- **KSocial (`Live.jsx`):** A mini-router for Live Entertainment. Locked behind a universal PIN (`1117`). Host "League Mode" is double-locked behind PIN (`1144`). Uses `KSocialHost` and `KSocialUser`.
- **The Map (`Map.jsx`):** Custom Dark-Mode Google Maps integration. Plots Venues, Active Events, and nearby Users.
- **Push Notifications:** Handled natively via the Web Notifications API intercepting Supabase realtime inserts.

## 7. CRITICAL Development Rules (Do Not Revert)
When writing or refactoring code for BHNL, you MUST adhere to the following rules based on previously solved bugs:
1. **Database Queries (`.maybeSingle()`):** ALWAYS use `.maybeSingle()` instead of `.single()` when querying Supabase for a single row. `.single()` is too strict and crashes the app if 0 rows are found.
2. **Timezone Safety (`EventsFeed.jsx`):** The app must calculate "Today" and render event calendars using strictly Black Hills local time (Mountain Daylight/Standard Time). Always use `toLocaleString('en-US', { timeZone: 'America/Denver' })` to prevent timezone drift for out-of-state users.
3. **Google Maps Script Loading:** In `Map.jsx`, NEVER inject the Google Maps API `<script>` tag blindly. Always check `if (window.google && window.google.maps)` first, and properly queue the `initMap` callback to prevent duplicate script injection and memory leaks.
4. **Tailwind v4 CSS Ordering:** In `index.css`, standard CSS `@import` statements (like Google Fonts) MUST precede `@import "tailwindcss";` or PostCSS will throw a fatal compiler error.
5. **Overlay State Management:** When navigating away from overlays (like `PublicProfile`), ensure `viewingEntity` and `searchResults` states are explicitly set to `null` to prevent UI freezing.