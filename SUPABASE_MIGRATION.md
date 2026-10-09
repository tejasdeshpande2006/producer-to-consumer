# Supabase Migration Guide

## What's Been Changed

### 1. **Installed Supabase Packages**
- `@supabase/supabase-js` - Supabase client
- `@supabase/auth-helpers-react` - Auth helpers

### 2. **Created Supabase Configuration**
- `src/supabase.ts` - Supabase client initialization
- `.env.local` - Environment variables (with placeholders)

### 3. **Updated Authentication**
- `src/context/AuthContext.tsx` - Now uses Supabase Auth instead of Firebase Auth
- Supabase session management
- Real-time profile subscriptions

### 4. **Database Schema**
- `supabase_full_schema.sql` - Complete database setup with:
   - Auth-triggered profiles table that mirrors the app's profile model
   - Products, Orders, OrderItems, Reviews tables
   - Transactions, Wishlist, Cart, and AuditLogs tables
   - Row-Level Security (RLS) policies and helper functions
   - Indexes and timestamp triggers for consistent updates

### 5. **Configuration Files Updated**
- `vite.config.ts` - Added Supabase env variables
- `package.json` - Removed Firebase, kept Supabase

### 6. **Removed Dependencies**
- ❌ `firebase`
- ❌ `firebase-admin`

---

## Next Steps: Set Up Your Supabase Project

### Step 1: Create Supabase Account & Project
1. Go to https://supabase.com
2. Sign up or log in
3. Create a **new organization**
4. Create a **new project**:
   - Project name: `p2c-ecommerce`
   - Database password: (create a strong password)
   - Region: (choose closest to you)
   - Click **"Create new project"** (takes 2-3 minutes)

### Step 2: Get Your Credentials
After project creation, go to **Settings → API**:
1. Copy **Project URL** → Replace `https://your-project.supabase.co` in `.env.local`
2. Copy **anon public key** → Replace `your-anon-key-here` in `.env.local`
3. Keep the **service_role secret** only for server-side usage if you add backend jobs later. Do not expose it in the browser.

### Step 3: Run Database Migration
1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Open `supabase_full_schema.sql` and copy the entire file
4. Paste it into the SQL editor
5. Click **"Run"**

This creates the schema, auth trigger, indexes, and RLS policies.

### Step 4: Update `.env.local`
```bash
VITE_SUPABASE_URL=https://your-actual-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key-here
GROK_API_KEY=your-grok-api-key-here
```

### Step 5: Configure Supabase Auth
1. In Supabase, open **Authentication → Providers**.
2. Enable **Email** login.
3. If you want Google sign-in, enable **Google** and add the OAuth client ID/secret.
4. In **Authentication → URL Configuration**, add your local and deployed redirect URLs.
5. Make sure the site URL matches your app origin, for example `http://localhost:5173`.

**Getting your Grok API Key:**
1. Go to https://console.x.ai
2. Sign up or log in with your X (Twitter) account
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy and paste it into `.env.local`

### Step 6: Install Dependencies & Run
```bash
npm install
npm run dev
```

### Step 7: Verify the Connection
1. Open the app in the browser.
2. Sign up or sign in with Supabase Auth.
3. Confirm a row appears in `profiles`.
4. Open the browser console and call the connection test if needed.
5. Verify products load from `products`, and the navbar wallet/profile data comes from `profiles`.

---

## Key Differences: Firebase → Supabase

| Feature | Firebase | Supabase |
|---------|----------|----------|
| **Database** | Firestore (NoSQL) | PostgreSQL (SQL) |
| **Auth** | Firebase Auth | Supabase Auth |
| **Storage** | Firebase Storage | Supabase Storage |
| **Client SDK** | `firebase/app` | `@supabase/supabase-js` |
| **Auth State** | `onAuthStateChanged()` | `onAuthStateChange()` |
| **Database Queries** | Realtime listeners | Realtime subscriptions |
| **Security** | Firestore Rules | PostgreSQL RLS Policies |

---

## Migrating Components

### Login Component Update Example
**Before (Firebase):**
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

await signInWithEmailAndPassword(auth, email, password);
```

**After (Supabase):**
```typescript
import { supabase } from '../supabase';

await supabase.auth.signInWithPassword({
  email,
  password,
});
```

### Fetching Data Update Example
**Before (Firestore):**
```typescript
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const querySnapshot = await getDocs(collection(db, 'products'));
```

**After (Supabase):**
```typescript
import { supabase } from '../supabase';

const { data, error } = await supabase
  .from('products')
  .select('*');
```

---

## Files Still Using Firebase (Need Updates)

These components still import Firebase and need to be updated:
- `src/pages/Login.tsx`
- `src/pages/Register.tsx`
- `src/pages/Home.tsx`
- `src/pages/ProducerDashboard.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/services/offlineDb.ts`
- `server.ts`

### Would you like me to:
1. Update all remaining Firebase references to Supabase?
2. Create Supabase auth helpers (login/register/logout)?
3. Create service files for products, orders, etc.?

---

## Optional content-generation integration

This project can optionally use an external content and route-generation service for enhanced product suggestions and delivery routing.

### Service usage

**Service file:** `src/services/grokService.ts`

**Features implemented:**
1. **Product Description Generation** (`generateProductDescription`)
   - Analyzes product title and images
   - Suggests category, price, and search tags
   - Used in ProducerDashboard.tsx

2. **Route Optimization** (`suggestOptimizedRoute`)
   - Generates optimized delivery routes
   - Avoids traffic bottlenecks (simulated)
   - Used in OrderTracking.tsx

### API key setup

1. Add the key to `.env.local`:
   ```
   GROK_API_KEY=your-key-here
   ```

2. If the key is unavailable, the app falls back to built-in default behavior.

---

## Troubleshooting

### "Missing GROK_API_KEY"
- Ensure `.env.local` has `GROK_API_KEY` set
- Restart the dev server after updating

### External API calls failing
- Check your API key is valid
- Verify you haven't exceeded the provider's rate limits
- Check your internet connection
- Review console errors for specific API error messages

### "Service response did not return valid JSON"
- Sometimes the external service returns plain text instead of JSON
- Check your prompt is clear and unambiguous
- Try again - some prompts may work better on retry
- Consider using a simpler prompt

---

## Troubleshooting

### "Missing Supabase credentials"
- Ensure `.env.local` is in the project root
- Make sure keys are not empty strings
- Restart the dev server after updating `.env.local`

### "Connection failed"
- Verify your Supabase project is created and running
- Check that your credentials are correct
- Try the connection test in browser console

### Database queries returning empty
- Run the SQL migration in Supabase SQL Editor
- Check Row-Level Security (RLS) policies in Supabase dashboard
- Ensure you're authenticated before querying

---

## Admin User Setup

Your admin email is hardcoded as `vpk525252@gmail.com`. To use a different admin email:

1. Find this in `src/context/AuthContext.tsx`:
   ```typescript
   if (session.user.email === 'vpk525252@gmail.com') {
   ```

2. Replace with your email, or change it to use an environment variable:
   ```typescript
   const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
   if (session.user.email === ADMIN_EMAIL) {
   ```

3. Add to `.env.local`:
   ```
   VITE_ADMIN_EMAIL=your-email@example.com
   ```

---

## Next: What to Update First

1. ✅ Create Supabase project & run migration
2. ✅ Update `.env.local` with real credentials
3. → Update `src/pages/Login.tsx` (authentication)
4. → Update `src/pages/Register.tsx` (authentication)
5. → Update `src/pages/Home.tsx` (fetch products)
6. → Update `src/services/offlineDb.ts` (if needed)
7. → Update `server.ts` (backend logic)

Would you like me to proceed with updating the Login and Register pages next?
