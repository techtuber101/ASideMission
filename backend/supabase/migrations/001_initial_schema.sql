-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE public.projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'New Project',
    description TEXT,
    sandbox JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) ON DELETE CASCADE
);

-- Create threads table
CREATE TABLE public.threads (
    thread_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(project_id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) ON DELETE CASCADE
);

-- Create messages table
CREATE TABLE public.messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.threads(thread_id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'user',
    content JSONB NOT NULL DEFAULT '{}',
    is_llm_message BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES public.threads(thread_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_projects_account_id ON public.projects(account_id);
CREATE INDEX idx_threads_account_id ON public.threads(account_id);
CREATE INDEX idx_threads_project_id ON public.threads(project_id);
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_type ON public.messages(type);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Account members can view their own projects"
    ON public.projects FOR SELECT
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can insert their own projects"
    ON public.projects FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can update their own projects"
    ON public.projects FOR UPDATE
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can delete their own projects"
    ON public.projects FOR DELETE
    USING (basejump.has_role_on_account(account_id));

-- RLS Policies for threads
CREATE POLICY "Account members can view their own threads"
    ON public.threads FOR SELECT
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can insert their own threads"
    ON public.threads FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can update their own threads"
    ON public.threads FOR UPDATE
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can delete their own threads"
    ON public.threads FOR DELETE
    USING (basejump.has_role_on_account(account_id));

-- RLS Policies for messages
CREATE POLICY "Account members can view messages in their threads"
    ON public.messages FOR SELECT
    USING (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

CREATE POLICY "Account members can insert messages in their threads"
    ON public.messages FOR INSERT
    WITH CHECK (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

CREATE POLICY "Account members can update messages in their threads"
    ON public.messages FOR UPDATE
    USING (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

CREATE POLICY "Account members can delete messages in their threads"
    ON public.messages FOR DELETE
    USING (
        thread_id IN (
            SELECT thread_id FROM public.threads 
            WHERE basejump.has_role_on_account(account_id)
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

