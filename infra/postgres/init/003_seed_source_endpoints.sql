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

insert into sources (province_id, name, type, authority_weight, base_url, enabled)
select p.id, 'Osmaniye Eczaci Odasi', 'pharmacists_chamber', 90, 'https://www.osmaniyeeczaciodasi.org.tr', true
from provinces p
where p.slug = 'osmaniye'
on conflict (province_id, name) do update set
  type = excluded.type,
  authority_weight = excluded.authority_weight,
  base_url = excluded.base_url,
  enabled = true;

insert into source_endpoints (
  source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
)
select
  s.id,
  null,
  'https://www.osmaniyeeczaciodasi.org.tr/nobetkarti',
  'html',
  'osmaniye_eo_v1',
  true,
  '0 * * * *',
  true
from sources s
join provinces p on p.id = s.province_id
where s.name = 'Osmaniye Eczaci Odasi' and p.slug = 'osmaniye'
on conflict (source_id, endpoint_url) do update set
  parser_key = excluded.parser_key,
  format = excluded.format,
  is_primary = excluded.is_primary,
  poll_cron = excluded.poll_cron,
  enabled = true;

update source_endpoints se
set enabled = false
from sources s
join provinces p on p.id = s.province_id
where se.source_id = s.id
  and s.name = 'Osmaniye Eczaci Odasi'
  and p.slug = 'osmaniye'
  and se.endpoint_url <> 'https://www.osmaniyeeczaciodasi.org.tr/nobetkarti';
