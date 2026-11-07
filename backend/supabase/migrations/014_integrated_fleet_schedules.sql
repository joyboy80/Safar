-- Migration: 014_integrated_fleet_schedules.sql
-- Integrated Bus Fleet & Schedule Management System

-- 1. Enhance buses table
alter table public.buses
  add column if not exists registration_number text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists operational_status text default 'Online';

-- Backfill registration_number from number
update public.buses
set registration_number = number
where registration_number is null;

-- Normalize operational_status
update public.buses
set operational_status = case
  when status = 'Running' or status = 'In Progress' then 'Running'
  when status = 'Maintenance' then 'Maintenance'
  when status = 'Stopped' then 'Stopped'
  else 'Online'
end
where operational_status is null or operational_status not in ('Online', 'Running', 'Stopped', 'Maintenance');

-- Add constraint for operational_status if not present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'buses_operational_status_check'
  ) then
    alter table public.buses
      add constraint buses_operational_status_check
      check (operational_status in ('Online', 'Running', 'Stopped', 'Maintenance'));
  end if;
end $$;

-- 2. Enhance transport_routes with departure_times
alter table public.transport_routes
  add column if not exists departure_times jsonb not null default '[]'::jsonb;

-- Populate standard departure times for the predefined routes
update public.transport_routes
set departure_times = '["05:45 AM", "01:30 PM", "04:15 PM"]'::jsonb
where id in ('CUET_STATION_DIRECT', 'CUET_STATION_GEC', 'CUET_STATION_FLYOVER_GEC')
  and (departure_times = '[]'::jsonb or departure_times is null);

update public.transport_routes
set departure_times = '["07:10 AM", "02:20 PM", "07:00 PM", "08:15 PM", "08:45 PM"]'::jsonb
where id in ('STATION_CUET_BAHADDARHAT', 'STATION_CUET_GEC')
  and (departure_times = '[]'::jsonb or departure_times is null);

-- 3. Enhance transport_schedules for integrated scheduling
alter table public.transport_schedules
  add column if not exists driver_id uuid references public.profiles(id) on delete restrict,
  add column if not exists route_id text references public.transport_routes(id) on delete restrict,
  add column if not exists schedule_date date,
  add column if not exists schedule_status text default 'Scheduled',
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- Backfill schedule_date from service_date if needed
update public.transport_schedules
set schedule_date = service_date
where schedule_date is null and service_date is not null;

update public.transport_schedules
set schedule_status = case
  when status = 'Completed' then 'Completed'
  when status = 'Cancelled' then 'Cancelled'
  when status in ('In Progress', 'Boarding', 'Running') then 'Running'
  else 'Scheduled'
end
where schedule_status is null or schedule_status not in ('Scheduled', 'Running', 'Completed', 'Cancelled');

-- Constraint on schedule_status
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transport_schedules_status_check'
  ) then
    alter table public.transport_schedules
      add constraint transport_schedules_status_check
      check (schedule_status in ('Scheduled', 'Running', 'Completed', 'Cancelled'));
  end if;
end $$;

-- 4. Unique constraints for schedules to prevent overlapping assignments
create index if not exists transport_schedules_bus_date_idx
  on public.transport_schedules (bus_id, schedule_date);

create index if not exists transport_schedules_driver_date_idx
  on public.transport_schedules (driver_id, schedule_date);

create unique index if not exists transport_schedules_active_bus_slot_unique
  on public.transport_schedules (bus_id, schedule_date, departure_time)
  where schedule_status not in ('Cancelled');

create unique index if not exists transport_schedules_active_driver_slot_unique
  on public.transport_schedules (driver_id, schedule_date, departure_time)
  where schedule_status not in ('Cancelled') and driver_id is not null;

-- 5. Drop obsolete shift trigger from legacy assignments
drop trigger if exists transport_assignments_validate on public.transport_assignments;

notify pgrst, 'reload schema';

