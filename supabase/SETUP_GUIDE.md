# SoGoJet — Supabase & OAuth Setup Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **New Project**
3. Choose an organization, name it `sogojet`, pick a region close to you, set a database password
4. Wait for the project to finish provisioning (~2 min)
5. Go to **Settings → API**
6. Copy **Project URL** and **anon/public key**
7. Paste them into your `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run** (or Cmd+Enter)
5. You should see "Success. No rows returned" — that means the tables and policies were created
6. Verify by going to **Table Editor** — you should see: `user_preferences`, `swipe_history`, `saved_trips`, `cached_prices`

## Step 3: Enable Email Auth (already on by default)

Supabase enables email/password auth by default. No action needed unless you want to customize confirmation emails:

1. Go to **Auth → Providers → Email**
2. Toggle "Confirm email" off for dev (optional — makes testing easier)

## Step 4: Set Up Google OAuth

### 4a: Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External** user type
   - Fill in app name: `SoGoJet`
   - Add your email as support email and developer contact
   - Click **Save and Continue** through scopes (no extra scopes needed)
   - Add test users (your email) if in testing mode
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
6. For **Web application**:
   - Name: `SoGoJet Web`
   - Authorized redirect URIs: add `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret**
7. (Optional) For **iOS**:
   - Name: `SoGoJet iOS`
   - Bundle ID: `com.sogojet.app`
8. (Optional) For **Android**:
   - Name: `SoGoJet Android`
   - Package name: `com.sogojet.app`

### 4b: Supabase Dashboard

1. Go to **Auth → Providers → Google**
2. Toggle **Enable Google provider** ON
3. Paste the **Client ID** and **Client Secret** from step 4a
4. The redirect URL is pre-filled — it should match what you added in Google Cloud Console
5. Click **Save**

## Step 5: Set Up Apple Sign-In (iOS only, optional)

1. Go to [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles
2. Register an App ID with "Sign in with Apple" capability
3. Create a Services ID for web auth
4. Generate a key for Sign in with Apple
5. In Supabase → **Auth → Providers → Apple**, enter:
   - Service ID (for web)
   - Team ID
   - Key ID
   - Private key (p8 file contents)

## Step 6: Configure Redirect URLs

### For web development (localhost):
- In Google Cloud Console, add `http://localhost:8081` to authorized JavaScript origins
- Supabase handles the OAuth callback automatically via its `/auth/v1/callback` endpoint

### For native (Expo):
- The app uses the `sogojet://` deep link scheme (already configured in `app.json`)
- The auth hook redirects to `sogojet://auth/callback` on native
- You may need to set up Expo AuthSession for production builds

## Verification

After setup, test the flow:

1. Run `npm run dev` (or `npm run web`)
2. You should see the login screen
3. Click "Continue with Google" — should redirect to Google sign-in
4. After signing in, you should land on the onboarding screen
5. Complete onboarding → lands on the swipe feed
6. Refresh the page → should auto-login (session persisted)
7. "Browse without account" → goes straight to feed
