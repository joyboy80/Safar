-- 013_featured_bus_photos.sql
-- Enables featured bus photos for carousel across user portals, powered by Cloudinary.

create table if not exists public.featured_bus_photos (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  image_url text not null,
  public_id text,
  bus_id text references public.buses(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists featured_bus_photos_active_idx
  on public.featured_bus_photos (is_active, display_order, created_at desc);

