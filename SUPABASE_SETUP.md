# Supabase Setup Guide

## Current Issue
The Supabase project URL `hrqbwuhvpotoeefakbszs.supabase.co` is not accessible, which is causing the "Failed to fetch" error in authentication.

## Solutions

### Option 1: Create a New Supabase Project (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project"
   - Choose your organization
   - Enter project name: "iris-chat"
   - Enter database password (save this!)
   - Choose region closest to you
   - Click "Create new project"

3. **Get Project Credentials**
   - Once project is created, go to Settings → API
   - Copy the following:
     - Project URL (e.g., `https://your-project-ref.supabase.co`)
     - Anon public key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

4. **Update Environment Variables**
   ```bash
   # Update frontend/.env.local with your new credentials
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Option 2: Use Development Mode (Current)

The app is currently configured to work without authentication. You can:
- Use the chat functionality without signing in
- All features work except user-specific data persistence
- Messages are stored temporarily in the session

### Option 3: Fix Existing Project

If you have an existing Supabase project:
1. Check if the project is paused in the dashboard
2. Verify the project URL is correct
3. Ensure the project is not deleted

## Database Schema

If you create a new project, you'll need to set up the database schema. The backend expects these tables:

```sql
-- Users table (handled by Supabase Auth)
-- Messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threads table
CREATE TABLE threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing Authentication

After setting up Supabase:
1. Restart the frontend: `npm run dev`
2. Go to `http://localhost:3000/auth`
3. Try creating an account
4. Test sign in/sign out functionality

## Current Status

- ✅ Chat functionality works without authentication
- ✅ Error handling added for Supabase connectivity issues
- ⚠️ Authentication requires valid Supabase project
- ⚠️ User-specific features need Supabase setup
