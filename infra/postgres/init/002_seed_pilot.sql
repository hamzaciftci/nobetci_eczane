with selected_day as (
  select
    case
      when extract(hour from now() at time zone 'Europe/Istanbul') < 8
        then (now() at time zone 'Europe/Istanbul' - interval '1 day')::date
      else (now() at time zone 'Europe/Istanbul')::date
    end as duty_date
),
province as (
  select id from provinces where slug = 'istanbul'
),
district as (
  insert into districts (province_id, name, slug)
  select province.id, 'Kadikoy', 'kadikoy'
  from province
  on conflict (province_id, slug) do update set name = excluded.name
  returning id, province_id
),
source_primary as (
  insert into sources (province_id, name, type, authority_weight, base_url, enabled)
  select province_id, 'Il Saglik Mudurlugu', 'health_directorate', 90, 'https://istanbul.saglik.gov.tr/nobetci-eczane', true
  from district
  on conflict (province_id, name) do update set enabled = true
  returning id
),
source_secondary as (
  insert into sources (province_id, name, type, authority_weight, base_url, enabled)
  select province_id, 'Eczaci Odasi', 'pharmacists_chamber', 75, 'https://istanbul.eo.org.tr/nobetci-eczaneler', true
  from district
  on conflict (province_id, name) do update set enabled = true
  returning id
),
pharmacy as (
  insert into pharmacies (
    province_id, district_id, canonical_name, normalized_name, address, phone, lat, lng, is_active
  )
  select
    d.province_id, d.id, 'Moda Eczanesi', 'moda eczanesi',
    'Caferaga Mah. Moda Cad. No:12', '02163445566', 40.988200, 29.030600, true
  from district d
  on conflict (district_id, normalized_name) do update set
    canonical_name = excluded.canonical_name,
    address = excluded.address,
    phone = excluded.phone,
    lat = excluded.lat,
    lng = excluded.lng,
    updated_at = now(),
    is_active = true
  returning id, province_id, district_id
),
duty as (
  insert into duty_records (
    pharmacy_id, province_id, district_id, duty_date, duty_start, duty_end,
    confidence_score, verification_source_count, last_verified_at, is_degraded
  )
  select
    p.id, p.province_id, p.district_id,
    sd.duty_date,
    ((sd.duty_date::text || ' 18:00:00')::timestamp at time zone 'Europe/Istanbul'),
    (((sd.duty_date + interval '1 day')::date::text || ' 08:00:00')::timestamp at time zone 'Europe/Istanbul'),
    96.00,
    2,
    now(),
    false
  from pharmacy p
  cross join selected_day sd
  on conflict (pharmacy_id, duty_date) do update set
    duty_start = excluded.duty_start,
    duty_end = excluded.duty_end,
    confidence_score = excluded.confidence_score,
    verification_source_count = excluded.verification_source_count,
    last_verified_at = now(),
    is_degraded = false,
    updated_at = now()
  returning id
)
insert into duty_evidence (duty_record_id, source_id, source_url, extracted_payload)
select duty.id, source_primary.id, 'https://istanbul.saglik.gov.tr/nobetci-eczane', '{"seed":"primary"}'::jsonb
from duty, source_primary
on conflict (duty_record_id, source_id, source_url) do update set seen_at = now();

with duty as (
  select id from duty_records
  order by created_at desc
  limit 1
),
source_secondary as (
  select id from sources
  where name = 'Eczaci Odasi'
  order by id desc
  limit 1
)
insert into duty_evidence (duty_record_id, source_id, source_url, extracted_payload)
select duty.id, source_secondary.id, 'https://istanbul.eo.org.tr/nobetci-eczaneler', '{"seed":"secondary"}'::jsonb
from duty, source_secondary
on conflict (duty_record_id, source_id, source_url) do update set seen_at = now();
