

# Plan: Execute Aura OS Database Migration

## Overview
Run the complete SQL migration from the uploaded file to replicate the Aura OS database schema in this Supabase project.

## Approach
The migration will be split into multiple sequential calls to the database migration tool, since some parts have dependencies and some touch reserved schemas that need careful handling.

### Migration 1: Extensions + Core Tables
- Enable extensions: `pgmq`, `pg_net`, `supabase_vault`
- Create 11 tables: `user_profiles`, `user_strategies`, `user_progress`, `user_usage`, `audience_profiles`, `push_subscriptions`, `usage_logs`, `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`
- Insert default row into `email_send_state`

### Migration 2: RLS + Policies
- Enable RLS on all 11 tables
- Create all RLS policies (user-scoped for app tables, service_role for email tables)

### Migration 3: Functions + Trigger + Queues + Grants
- Create functions: `handle_new_user`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`
- Create trigger `on_auth_user_created` on `auth.users`
- Create PGMQ queues: `auth_emails`, `transactional_emails`, and their DLQs
- Set up GRANT/REVOKE for email functions

### Migration 4: Storage Bucket + Policies
- Create `media-uploads` storage bucket
- Add storage policies for authenticated user upload/read/delete

## Important Notes
- The trigger on `auth.users` is required for auto-creating user profiles on signup — this is a read from auth schema via trigger, which is a standard Supabase pattern
- The SQL will be executed exactly as provided from the Aura OS project
- After migration, the Supabase types will auto-update to reflect the new tables

