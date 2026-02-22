create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type source_type as enum ('health_directorate', 'pharmacists_chamber', 'official_integration', 'manual');
create type source_format as enum ('html', 'html_table', 'html_js', 'pdf', 'image', 'api');
create type run_status as enum ('success', 'partial', 'failed');
create type conflict_status as enum ('open', 'resolved', 'ignored');

create table if not exists provinces (
  id smallserial primary key,
  code char(2) unique not null,
  name text unique not null,
  slug text unique not null
);

create table if not exists districts (
  id serial primary key,
  province_id smallint not null references provinces(id),
  name text not null,
  slug text not null,
  unique (province_id, slug)
);

create table if not exists pharmacies (
  id uuid primary key default gen_random_uuid(),
  province_id smallint not null references provinces(id),
  district_id int not null references districts(id),
  canonical_name text not null,
  normalized_name text not null,
  address text not null,
  phone text not null,
  lat numeric(9, 6),
  lng numeric(9, 6),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (district_id, normalized_name)
);

create table if not exists sources (
  id serial primary key,
  province_id smallint not null references provinces(id),
  name text not null,
  type source_type not null,
  authority_weight smallint not null check (authority_weight between 1 and 100),
  base_url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (province_id, name)
);

create table if not exists source_endpoints (
  id serial primary key,
  source_id int not null references sources(id),
  district_id int references districts(id),
  endpoint_url text not null,
  format source_format not null,
  parser_key text not null,
  is_primary boolean not null default false,
  poll_cron text not null,
  enabled boolean not null default true,
  unique (source_id, endpoint_url)
);

create table if not exists ingestion_runs (
  id bigserial primary key,
  source_endpoint_id int not null references source_endpoints(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status run_status not null,
  http_status int,
  etag text,
  last_modified text,
  error_message text
);

create table if not exists source_snapshots (
  id bigserial primary key,
  source_endpoint_id int not null references source_endpoints(id),
  captured_at timestamptz not null default now(),
  source_url text not null,
  raw_payload text not null,
  checksum text not null
);

create table if not exists duty_records (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references pharmacies(id),
  province_id smallint not null references provinces(id),
  district_id int not null references districts(id),
  duty_date date not null,
  duty_start timestamptz not null,
  duty_end timestamptz not null,
  confidence_score numeric(5, 2) not null check (confidence_score between 0 and 100),
  verification_source_count smallint not null check (verification_source_count >= 1),
  last_verified_at timestamptz not null,
  is_degraded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, duty_date)
);

create table if not exists duty_evidence (
  duty_record_id uuid not null references duty_records(id) on delete cascade,
  source_id int not null references sources(id),
  source_url text not null,
  seen_at timestamptz not null default now(),
  extracted_payload jsonb not null,
  primary key (duty_record_id, source_id, source_url)
);

create table if not exists duty_conflicts (
  id bigserial primary key,
  province_id smallint not null references provinces(id),
  district_id int not null references districts(id),
  duty_date date not null,
  reason text not null,
  payload jsonb not null,
  status conflict_status not null default 'open',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists correction_reports (
  id bigserial primary key,
  province_id smallint not null references provinces(id),
  district_id int references districts(id),
  pharmacy_name text not null,
  issue_type text not null,
  note text,
  contact_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  status text not null default 'new'
);

create table if not exists ingestion_alerts (
  id bigserial primary key,
  province_id smallint not null references provinces(id),
  source_endpoint_id int references source_endpoints(id),
  alert_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_duty_lookup on duty_records (province_id, district_id, duty_date);
create index if not exists idx_pharmacy_name_trgm on pharmacies using gin (normalized_name gin_trgm_ops);
create index if not exists idx_runs_endpoint_time on ingestion_runs (source_endpoint_id, started_at desc);
create index if not exists idx_conflicts_open on duty_conflicts (status, duty_date);
create index if not exists idx_ingestion_alerts_created on ingestion_alerts (province_id, created_at desc);

create or replace view api_active_duty as
select
  dr.id,
  ph.canonical_name as eczane_adi,
  pr.slug as il_slug,
  pr.name as il,
  d.slug as ilce_slug,
  d.name as ilce,
  ph.address as adres,
  ph.phone as telefon,
  ph.lat as lat,
  ph.lng as lng,
  string_agg(distinct s.name, ', ') as kaynak,
  min(de.source_url) as kaynak_url,
  dr.last_verified_at as son_guncelleme,
  dr.confidence_score as dogruluk_puani,
  dr.verification_source_count as dogrulama_kaynagi_sayisi,
  dr.is_degraded
from duty_records dr
join pharmacies ph on ph.id = dr.pharmacy_id
join provinces pr on pr.id = dr.province_id
join districts d on d.id = dr.district_id
join duty_evidence de on de.duty_record_id = dr.id
join sources s on s.id = de.source_id
where dr.duty_date = (now() at time zone 'Europe/Istanbul')::date
group by
  dr.id,
  ph.canonical_name,
  pr.slug,
  pr.name,
  d.slug,
  d.name,
  ph.address,
  ph.phone,
  ph.lat,
  ph.lng,
  dr.last_verified_at,
  dr.confidence_score,
  dr.verification_source_count,
  dr.is_degraded;

insert into provinces (code, name, slug) values
('01','Adana','adana'),
('02','Adiyaman','adiyaman'),
('03','Afyonkarahisar','afyonkarahisar'),
('04','Agri','agri'),
('05','Amasya','amasya'),
('06','Ankara','ankara'),
('07','Antalya','antalya'),
('08','Artvin','artvin'),
('09','Aydin','aydin'),
('10','Balikesir','balikesir'),
('11','Bilecik','bilecik'),
('12','Bingol','bingol'),
('13','Bitlis','bitlis'),
('14','Bolu','bolu'),
('15','Burdur','burdur'),
('16','Bursa','bursa'),
('17','Canakkale','canakkale'),
('18','Cankiri','cankiri'),
('19','Corum','corum'),
('20','Denizli','denizli'),
('21','Diyarbakir','diyarbakir'),
('22','Edirne','edirne'),
('23','Elazig','elazig'),
('24','Erzincan','erzincan'),
('25','Erzurum','erzurum'),
('26','Eskisehir','eskisehir'),
('27','Gaziantep','gaziantep'),
('28','Giresun','giresun'),
('29','Gumushane','gumushane'),
('30','Hakkari','hakkari'),
('31','Hatay','hatay'),
('32','Isparta','isparta'),
('33','Mersin','mersin'),
('34','Istanbul','istanbul'),
('35','Izmir','izmir'),
('36','Kars','kars'),
('37','Kastamonu','kastamonu'),
('38','Kayseri','kayseri'),
('39','Kirklareli','kirklareli'),
('40','Kirsehir','kirsehir'),
('41','Kocaeli','kocaeli'),
('42','Konya','konya'),
('43','Kutahya','kutahya'),
('44','Malatya','malatya'),
('45','Manisa','manisa'),
('46','Kahramanmaras','kahramanmaras'),
('47','Mardin','mardin'),
('48','Mugla','mugla'),
('49','Mus','mus'),
('50','Nevsehir','nevsehir'),
('51','Nigde','nigde'),
('52','Ordu','ordu'),
('53','Rize','rize'),
('54','Sakarya','sakarya'),
('55','Samsun','samsun'),
('56','Siirt','siirt'),
('57','Sinop','sinop'),
('58','Sivas','sivas'),
('59','Tekirdag','tekirdag'),
('60','Tokat','tokat'),
('61','Trabzon','trabzon'),
('62','Tunceli','tunceli'),
('63','Sanliurfa','sanliurfa'),
('64','Usak','usak'),
('65','Van','van'),
('66','Yozgat','yozgat'),
('67','Zonguldak','zonguldak'),
('68','Aksaray','aksaray'),
('69','Bayburt','bayburt'),
('70','Karaman','karaman'),
('71','Kirikkale','kirikkale'),
('72','Batman','batman'),
('73','Sirnak','sirnak'),
('74','Bartin','bartin'),
('75','Ardahan','ardahan'),
('76','Igdir','igdir'),
('77','Yalova','yalova'),
('78','Karabuk','karabuk'),
('79','Kilis','kilis'),
('80','Osmaniye','osmaniye'),
('81','Duzce','duzce')
on conflict (code) do nothing;
