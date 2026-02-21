update source_endpoints
set poll_cron = '0 * * * *'
where enabled = true
  and poll_cron <> '0 * * * *';
