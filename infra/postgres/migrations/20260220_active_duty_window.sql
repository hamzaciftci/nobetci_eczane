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
where dr.duty_date = (
  case
    when extract(hour from now() at time zone 'Europe/Istanbul') < 8
      then ((now() at time zone 'Europe/Istanbul') - interval '1 day')::date
    else (now() at time zone 'Europe/Istanbul')::date
  end
)
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
