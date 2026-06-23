-- Run once in the Supabase SQL editor.
-- Create a private storage bucket named "pdf-library" in the Supabase dashboard
-- (Storage → New bucket → pdf-library → private).

create table if not exists public.pdf_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  title text not null,
  file_name text not null,
  storage_path text not null unique,
  file_size bigint not null,
  page_count int,
  created_at timestamptz not null default now()
);

create index if not exists pdf_documents_tenant_created_idx
  on public.pdf_documents (tenant_id, created_at desc);

-- All PDF library access goes through Next.js API using the service role key.
alter table public.pdf_documents disable row level security;

grant usage on schema public to postgres, service_role;
grant all on table public.pdf_documents to postgres, service_role;

-- If you already created the table and see "permission denied", run only:
-- supabase/pdf-library-fix-permissions.sql
