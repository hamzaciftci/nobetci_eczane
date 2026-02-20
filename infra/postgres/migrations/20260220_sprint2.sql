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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'source_endpoints_source_id_endpoint_url_key'
  ) then
    alter table source_endpoints
      add constraint source_endpoints_source_id_endpoint_url_key unique (source_id, endpoint_url);
  end if;
end $$;

insert into sources (province_id, name, type, authority_weight, base_url, enabled)
select p.id, 'Istanbul Il Saglik Mudurlugu', 'health_directorate', 90, 'https://istanbulsaglik.gov.tr', true
from provinces p
where p.slug = 'istanbul'
on conflict (province_id, name) do update set
  type = excluded.type,
  authority_weight = excluded.authority_weight,
  base_url = excluded.base_url,
  enabled = true;

insert into sources (province_id, name, type, authority_weight, base_url, enabled)
select p.id, 'Istanbul Eczaci Odasi', 'pharmacists_chamber', 80, 'https://www.istanbuleczaciodasi.org.tr', true
from provinces p
where p.slug = 'istanbul'
on conflict (province_id, name) do update set
  type = excluded.type,
  authority_weight = excluded.authority_weight,
  base_url = excluded.base_url,
  enabled = true;

insert into sources (province_id, name, type, authority_weight, base_url, enabled)
select p.id, 'Adana Il Saglik Mudurlugu', 'health_directorate', 90, 'https://nobetcieczane.adanasm.gov.tr', true
from provinces p
where p.slug = 'adana'
on conflict (province_id, name) do update set
  type = excluded.type,
  authority_weight = excluded.authority_weight,
  base_url = excluded.base_url,
  enabled = true;

insert into sources (province_id, name, type, authority_weight, base_url, enabled)
select p.id, 'Adana Eczaci Odasi', 'pharmacists_chamber', 80, 'https://www.adanaeo.org.tr', true
from provinces p
where p.slug = 'adana'
on conflict (province_id, name) do update set
  type = excluded.type,
  authority_weight = excluded.authority_weight,
  base_url = excluded.base_url,
  enabled = true;

insert into source_endpoints (
  source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
)
select s.id, null, 'https://istanbulism.saglik.gov.tr/TR-108128/nobetci-eczane.html', 'html', 'istanbul_primary_v1', true, '*/15 * * * *', true
from sources s
join provinces p on p.id = s.province_id
where p.slug = 'istanbul' and s.name = 'Istanbul Il Saglik Mudurlugu'
on conflict (source_id, endpoint_url) do update set
  parser_key = excluded.parser_key,
  format = excluded.format,
  is_primary = excluded.is_primary,
  poll_cron = excluded.poll_cron,
  enabled = true;

insert into source_endpoints (
  source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
)
select s.id, null, 'https://www.istanbuleczaciodasi.org.tr/nobetci-eczane/', 'html', 'istanbul_secondary_v1', false, '*/15 * * * *', true
from sources s
join provinces p on p.id = s.province_id
where p.slug = 'istanbul' and s.name = 'Istanbul Eczaci Odasi'
on conflict (source_id, endpoint_url) do update set
  parser_key = excluded.parser_key,
  format = excluded.format,
  is_primary = excluded.is_primary,
  poll_cron = excluded.poll_cron,
  enabled = true;

insert into source_endpoints (
  source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
)
select s.id, null, 'https://nobetcieczane.adanasm.gov.tr/', 'html_js', 'adana_primary_v1', true, '*/15 * * * *', true
from sources s
join provinces p on p.id = s.province_id
where p.slug = 'adana' and s.name = 'Adana Il Saglik Mudurlugu'
on conflict (source_id, endpoint_url) do update set
  parser_key = excluded.parser_key,
  format = excluded.format,
  is_primary = excluded.is_primary,
  poll_cron = excluded.poll_cron,
  enabled = true;

insert into source_endpoints (
  source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
)
select s.id, null, 'https://www.adanaeo.org.tr/nobetci-eczaneler', 'html', 'adana_secondary_v1', false, '*/20 * * * *', true
from sources s
join provinces p on p.id = s.province_id
where p.slug = 'adana' and s.name = 'Adana Eczaci Odasi'
on conflict (source_id, endpoint_url) do update set
  parser_key = excluded.parser_key,
  format = excluded.format,
  is_primary = excluded.is_primary,
  poll_cron = excluded.poll_cron,
  enabled = true;
