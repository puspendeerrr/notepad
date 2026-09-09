# Notepad (`notepad.puspender.in`)

A minimal, secure, distraction-free online notepad built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Tiptap / ProseMirror**, and **Supabase (Auth + PostgreSQL with Row Level Security)**.

Engineered as a single full-stack Next.js application deployed seamlessly on **Vercel** with custom domain `notepad.puspender.in`.

---

## 🏗 Architecture

```text
https://notepad.puspender.in
        ↓
Single Next.js Full-Stack App on Vercel
        ├─ Frontend (React 19, Tiptap Editor, Tailwind CSS, System / Dark / Light themes)
        ├─ Next.js App Router API Routes
        ├─ Serverless Persistent Rate Limiting (Supabase-backed)
        ├─ Dynamic Note Routes (/notes/[slug] with legacy UUID fallback)
        └─ Health Check (/api/health)
        ↓
Supabase
        ├─ Auth (User ID mapped internally to <username>@notepad.internal)
        ├─ PostgreSQL with strict Row Level Security (RLS)
        └─ Persistent Rate Limit Storage (Admin-only access)
```

> **Note**: No standalone backend servers (Express, Railway, Render, etc.) are used or required. Everything runs inside Next.js serverless functions on Vercel.

---

## ✨ Features

- **Distraction-Free Rich-Text Writing**:
  - Full-page responsive canvas blending into dark charcoal and crisp light backgrounds.
  - Word-style auto-formatting (`1.` for ordered lists, `*` / `-` / `+` for bullet lists).
  - Clean paragraph line spacing with smooth focus transitions.
  - Keyboard shortcuts (`Ctrl/Cmd + S` to save, `Ctrl/Cmd + Shift + F` for focus mode, `Ctrl/Cmd + B/I/U/K`).
  - Title-based canonical slug URLs (e.g. `/notes/meeting-notes`, `/notes/meeting-notes-2`) with automatic legacy UUID redirects.
  - Live status bar: word count, character count, save state indicator.

- **Private User ID & Password Authentication**:
  - No email, phone number, OTP, or third-party OAuth tracking.
  - Usernames mapped internally to Supabase Auth (`<username>@notepad.internal`).
  - Cryptographic 24-character Recovery Key (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`) generated upon signup.
  - Recovery Key hashed server-side with HMAC-SHA-256 + secret salt/pepper (`RECOVERY_KEY_PEPPER`). Raw key is never stored in database or exposed to client.
  - Constant-time verification (`crypto.timingSafeEqual`) protects against timing attacks.

- **Production Security & Hardening**:
  - Persistent serverless rate limiting on sensitive auth endpoints (`/login`, `/signup`, `/reset-password`, `/regenerate-recovery-key`).
  - Comprehensive HTTP Security Headers via `next.config.ts`:
    - Content Security Policy (CSP)
    - X-Content-Type-Options: `nosniff`
    - X-Frame-Options: `DENY`
    - Referrer-Policy: `strict-origin-when-cross-origin`
    - Permissions-Policy
  - Strict Row Level Security (RLS) on all PostgreSQL tables.

- **Dual-Layer Autosave**:
  - 800ms debounced autosave to Supabase database.
  - Immediate save on `Ctrl/Cmd + S`, blur, or navigation.
  - IndexedDB (`idb-keyval`) local caching scoped by user and note so drafts are never lost.

---

## 🔑 Environment Variables

Configure these variables in your environment (`.env.local` for local development, and Vercel Project Settings for production):

| Variable Name | Environment | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Browser & Server) | Supabase Project URL (`https://<project-id>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (Browser & Server) | Supabase Publishable / Anon Key |
| `SUPABASE_SECRET_KEY` | **Server Only** | Supabase Secret / Service Role Key (Admin operations) |
| `RECOVERY_KEY_PEPPER` | **Server Only** | Secret salt string for HMAC-SHA-256 hashing of recovery keys |
| `NEXT_PUBLIC_APP_URL` | Public (Browser & Server) | Canonical app URL: `https://notepad.puspender.in` |

### Backward Compatibility Fallbacks

If your environment already uses the legacy naming convention, they are supported as fallbacks:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (fallback for `SUPABASE_SECRET_KEY`)

---

## 🗄 Database Setup & Migrations

In your Supabase Dashboard:

### Option A: Fresh Setup
1. Go to **SQL Editor** -> **New query**.
2. Paste and run the entire contents of [`supabase/schema.sql`](file:///c:/Users/puska/Documents/Notepad/supabase/schema.sql).
3. This creates:
   - `user_accounts` table + unique constraints
   - `user_settings` table
   - `notes` table + unique index `notes_user_slug_unique`
   - `rate_limits` table + compound index + RLS
   - `handle_updated_at` triggers

### Option B: Incremental Migrations (Existing Database)
If your database already has prior tables, run these migrations in order:
1. [`supabase/migration_add_slug.sql`](file:///c:/Users/puska/Documents/Notepad/supabase/migration_add_slug.sql) — Adds slug column.
2. [`supabase/migration_slug_unique.sql`](file:///c:/Users/puska/Documents/Notepad/supabase/migration_slug_unique.sql) — Sets non-null constraint and creates `notes_user_slug_unique` index on `(user_id, slug)`.
3. [`supabase/migration_rate_limits.sql`](file:///c:/Users/puska/Documents/Notepad/supabase/migration_rate_limits.sql) — Creates `rate_limits` table for persistent serverless rate limiting.

### Supabase Auth Configuration
In your Supabase Dashboard:
1. Go to **Authentication** -> **Providers** -> **Email**:
   - Ensure **Email provider is ENABLED**.
   - Ensure **Confirm email is DISABLED** (since usernames map to internal virtual emails).
2. Go to **Authentication** -> **URL Configuration**:
   - **Site URL**: `https://notepad.puspender.in`
   - **Redirect URLs**: Add `https://notepad.puspender.in/**`

---

## 💻 Local Development

1. Clone repository:
   ```bash
   git clone <repo-url>
   cd Notepad
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials and `RECOVERY_KEY_PEPPER`.

4. Run development server:
   ```bash
   npm run dev
   ```

5. Test production build locally:
   ```bash
   npm run build
   npm run start
   ```

---

## 🚀 Vercel Production Deployment

### 1. Push Repository to GitHub
Ensure all changes are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Prepare production deployment for notepad.puspender.in"
git push origin main
```

### 2. Import Project in Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Keep the framework preset as **Next.js** (root directory `./`).

### 3. Add Environment Variables in Vercel
In the Vercel project configuration, expand **Environment Variables** and add:
- `NEXT_PUBLIC_SUPABASE_URL`: `https://<your-project-id>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: `<your-publishable-or-anon-key>`
- `SUPABASE_SECRET_KEY`: `<your-secret-or-service-role-key>`
- `RECOVERY_KEY_PEPPER`: `<your-random-32+-char-secret-string>`
- `NEXT_PUBLIC_APP_URL`: `https://notepad.puspender.in`

*(Select Production, Preview, and Development environments).*

### 4. Deploy
Click **Deploy**. Vercel will run `npm run build` and launch the application.

---

## 🌐 Custom Domain Setup (`notepad.puspender.in`)

### Step 1: Add Domain in Vercel
1. In your Vercel project, go to **Settings** -> **Domains**.
2. Enter `notepad.puspender.in` and click **Add**.

### Step 2: Configure DNS Record
Log in to the DNS management panel for domain `puspender.in` (e.g. Cloudflare, Namecheap, GoDaddy, Hostinger):
- **Record Type**: `CNAME`
- **Name / Host**: `notepad`
- **Target / Value**: `cname.vercel-dns.com`
- **TTL**: `Auto` or `3600`
- *(If using Cloudflare, set Proxy status to "DNS only" initially until SSL verifies).*

### Step 3: Verify SSL & Live App
1. Vercel will automatically generate a Let's Encrypt SSL certificate within a few minutes.
2. Verify the health check:
   ```bash
   curl -I https://notepad.puspender.in/api/health
   ```
   Should return `HTTP/2 200` with security headers.
3. Open `https://notepad.puspender.in` in your browser.

---

## 🛡 Security & Verification Checklist

- [x] TypeScript compilation: 0 errors (`npx tsc --noEmit`)
- [x] Production build: 0 errors (`npm run build`)
- [x] Health check endpoint: `/api/health` returns healthy JSON
- [x] Security headers: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- [x] Serverless rate limiting: Persistent in Supabase `rate_limits` with memory fallback
- [x] Secrets protection: Secret keys restricted to server; `.gitignore` covers `.env*`
- [x] Row Level Security (RLS) active on all tables
- [x] Direct refresh on `/notes/[slug]` functions seamlessly
- [x] Legacy UUID note URLs redirect to canonical slug URLs
- [x] Recovery key never stored in plaintext and never sent to browser
