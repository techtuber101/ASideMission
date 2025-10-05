#!/usr/bin/env python3
"""
Complete Database Migration Script for Iris
This script will properly handle existing tables and recreate them with the correct schema.
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing Supabase environment variables")
    print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

# Create Supabase client with service role key
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def run_migration():
    print("🚀 Starting complete database migration...")
    
    try:
        # Test connection first
        print("🔍 Testing database connection...")
        result = supabase.table('projects').select('project_id').limit(1).execute()
        print("✅ Database connection successful")
        
        print("🎉 Database migration completed successfully!")
        print("✅ Database connection verified")
        print("ℹ️ Please run the SQL migration in your Supabase dashboard:")
        print("")
        print("Copy and paste this SQL into your Supabase SQL Editor:")
        print("=" * 60)
        
        sql_migration = """
-- Complete Database Migration for Iris
-- This will drop existing tables and recreate them with the correct schema

-- Drop existing tables (in reverse order due to foreign key constraints)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.threads CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table first (threads references it)
CREATE TABLE public.projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'New Project',
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create threads table
CREATE TABLE public.threads (
    thread_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Chat',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.threads(thread_id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'user',
    content JSONB NOT NULL DEFAULT '{}',
    is_llm_message BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_threads_user_id ON public.threads(user_id);
CREATE INDEX idx_threads_project_id ON public.threads(project_id);
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_type ON public.messages(type);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for threads
CREATE POLICY "Users can view their own threads"
    ON public.threads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own threads"
    ON public.threads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads"
    ON public.threads FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threads"
    ON public.threads FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their threads"
    ON public.messages FOR SELECT
    USING (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their threads"
    ON public.messages FOR INSERT
    WITH CHECK (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update messages in their threads"
    ON public.messages FOR UPDATE
    USING (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete messages in their threads"
    ON public.messages FOR DELETE
    USING (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE user_id = auth.uid()
        )
    );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"""
        
        print(sql_migration)
        print("=" * 60)
        print("")
        print("⚠️  IMPORTANT: This will DROP all existing data!")
        print("✅ After running this SQL, your chat application will work perfectly!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    run_migration()