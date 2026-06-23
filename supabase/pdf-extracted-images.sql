-- Run once in the Supabase SQL editor after pdf-library.sql.
-- Create a private storage bucket named "pdf-library-images" in the dashboard
-- (Storage → New bucket → pdf-library-images → private).

alter table public.pdf_documents
  add column if not exists analysis_status text not null default 'none'
  check (analysis_status in ('none', 'processing', 'complete', 'failed'));

create table if not exists public.pdf_extracted_images (
  id uuid primary key default gen_random_uuid(),
  pdf_document_id uuid not null references public.pdf_documents(id) on delete cascade,
  page_number int not null,
  image_index int not null,
  storage_path text not null,
  width int not null,
  height int not null,
  product_type text,
  labels text[] not null default '{}',
  description text,
  is_merchandise boolean not null default true,
  analyzed_at timestamptz not null default now(),
  unique (pdf_document_id, page_number, image_index)
);

create index if not exists pdf_extracted_images_doc_idx
  on public.pdf_extracted_images (pdf_document_id, page_number, image_index);

alter table public.pdf_extracted_images disable row level security;

grant usage on schema public to postgres, service_role;
grant all on table public.pdf_extracted_images to postgres, service_role;
