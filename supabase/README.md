# UnifyChat Database (Supabase)

This folder contains the **clean, independent** database setup for UnifyChat, built on Supabase.

The schema is designed to align exactly with the existing frontend, so **no UI changes are required**.

---

## Overview

The database uses the `public` schema and models a WhatsApp-style chat application:

- **`profiles`**: user profile and presence
- **`conversations`**: one-to-one and group chats
- **`conversation_participants`**: membership of users in conversations
- **`messages`**: chat messages
- **`message_read_receipts`**: per-user read status for messages
- **`typing_indicators`**: ephemeral typing state for users in conversations
- **`storage.buckets` / `storage.objects`**: public `avatars` bucket for profile images

Row Level Security (RLS) is enabled on all user-facing tables with policies that:

- Restrict data to authenticated users
- Ensure users only see conversations and messages they participate in
- Ensure users can only modify their own content (profiles, messages, typing state)

---

## Files

- `config.toml`  
  Contains the Supabase `project_id`. This is used by the Supabase CLI and does **not** affect the frontend bundle.

- `migrations/`  
  Historical SQL migrations that were used to evolve the schema. These are retained for compatibility but contain **no Lovable-specific logic**.

- `schema.sql`  
  Canonical, self-contained definition of the current schema. This is the simplest way to create a **fresh database** that matches what the frontend expects.

---

## Applying the schema to a fresh Supabase project

You can use either Supabase's hosted UI (SQL editor) or the CLI.

### Option 1: Using the Supabase web console

1. Create a new Supabase project (or reset an existing one).
2. Open the **SQL Editor** in the Supabase dashboard.
3. Paste the contents of `schema.sql`.
4. Run the script.

This will:

- Create all tables and relationships
- Configure RLS policies
- Add triggers and helper functions
- Enable realtime on key tables
- Create the `avatars` storage bucket and policies

### Option 2: Using the Supabase CLI

If you prefer migrations, you can:

1. Make sure `config.toml` points to your project.
2. Create a new migration containing `schema.sql`, or run it directly:

```bash
supabase db reset        # optional: wipes local DB managed by the CLI
supabase db execute supabase/schema.sql
```

This keeps the local database in sync with the schema used by the frontend types in `src/integrations/supabase/types.ts`.

---

## How the frontend talks to the DB

The frontend integrates with Supabase purely through the generated client and types:

- `src/integrations/supabase/client.ts`  
  Creates a typed Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

- `src/integrations/supabase/types.ts`  
  Contains the TypeScript `Database` type that reflects the tables and functions defined in `schema.sql`.

As long as `schema.sql` is applied to your Supabase project, the existing hooks and data fetching logic in the frontend will continue to work without modification.

---

## Independence from Lovable

- No tables, functions, or policies mention Lovable or gpt-engineer.
- The schema is generic and focused solely on UnifyChat's domain (users, conversations, messages).
- You can evolve this schema further using standard Supabase migrations or direct SQL changes, independent of any code generator.

