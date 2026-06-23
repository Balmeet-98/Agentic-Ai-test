-- Run this in Supabase SQL editor if you see:
-- "permission denied for table pdf_documents"

alter table public.pdf_documents disable row level security;

grant usage on schema public to postgres, service_role;
grant all on table public.pdf_documents to postgres, service_role;
