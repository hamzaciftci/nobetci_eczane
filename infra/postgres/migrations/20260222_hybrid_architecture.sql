create table if not exists duty_pharmacies (
  id bigserial primary key,
  province_slug text not null,
  province text not null,
  district_slug text not null,
  district text not null,
  pharmacy_name text not null,
  pharmacy_name_norm text not null,
  address text not null,
  address_norm text not null,
  phone text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  duty_date date not null,
  duty_start timestamptz not null,
  duty_end timestamptz not null,
  duty_hours text not null,
  source text not null,
  source_url text not null,
  confidence_score numeric(5, 2) not null default 0,
  verification_source_count smallint not null default 1,
  is_degraded boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (province_slug, district_slug, duty_date, pharmacy_name_norm)
);

create table if not exists duty_pharmacies_archive (
  id bigserial primary key,
  province_slug text not null,
  province text not null,
  district_slug text not null,
  district text not null,
  pharmacy_name text not null,
  pharmacy_name_norm text not null,
  address text not null,
  address_norm text not null,
  phone text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  duty_date date not null,
  duty_start timestamptz not null,
  duty_end timestamptz not null,
  duty_hours text not null,
  source text not null,
  source_url text not null,
  confidence_score numeric(5, 2) not null default 0,
  verification_source_count smallint not null default 1,
  is_degraded boolean not null default false,
  updated_at timestamptz not null,
  created_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create table if not exists mismatch_log (
  id bigserial primary key,
  province text not null,
  district text not null,
  province_slug text not null,
  district_slug text not null,
  duty_date date not null,
  pharmacy_name text not null,
  type text not null check (type in ('ADDED', 'REMOVED', 'TIME_MISMATCH', 'ADDRESS_MISMATCH')),
  source_value text,
  project_value text,
  detected_at timestamptz not null default now()
);

create table if not exists accuracy_stats (
  id bigserial primary key,
  duty_date date not null,
  total_districts int not null check (total_districts >= 0),
  full_match_districts int not null check (full_match_districts >= 0),
  total_mismatch int not null check (total_mismatch >= 0),
  accuracy_ratio numeric(6, 2) not null check (accuracy_ratio >= 0 and accuracy_ratio <= 100),
  last_check timestamptz not null default now()
);

create table if not exists ingestion_retry_queue (
  id bigserial primary key,
  province_slug text not null,
  source_endpoint_id int references source_endpoints(id),
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  retry_count int not null default 0,
  next_retry_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_duty_pharmacies_lookup
  on duty_pharmacies (province_slug, district_slug, duty_date, updated_at desc);
create index if not exists idx_duty_pharmacies_date
  on duty_pharmacies (duty_date, province_slug);
create index if not exists idx_duty_archive_lookup
  on duty_pharmacies_archive (province_slug, district_slug, duty_date, archived_at desc);
create index if not exists idx_mismatch_log_lookup
  on mismatch_log (duty_date, province_slug, district_slug, detected_at desc);
create index if not exists idx_accuracy_stats_recent
  on accuracy_stats (duty_date desc, last_check desc);
create index if not exists idx_retry_queue_pending
  on ingestion_retry_queue (status, next_retry_at asc);
