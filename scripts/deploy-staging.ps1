param(
  [string]$ComposeFile = "infra/deploy/docker-compose.staging.yml",
  [string]$MigrationFile = "infra/postgres/migrations/20260220_sprint2.sql"
)

$ErrorActionPreference = "Stop"

Write-Host "[staging] install dependencies"
pnpm install --frozen-lockfile

Write-Host "[staging] quality gates"
pnpm typecheck
pnpm lint
pnpm build

Write-Host "[staging] optional smoke tests (expects running services)"
if ($env:SKIP_SMOKE -ne "1") {
  pnpm smoke
}

if ($env:STAGING_DATABASE_URL) {
  Write-Host "[staging] apply migration $MigrationFile"
  psql $env:STAGING_DATABASE_URL -f $MigrationFile
} else {
  Write-Host "[staging] STAGING_DATABASE_URL is empty, migration skipped"
}

Write-Host "[staging] deploy containers"
docker compose -f $ComposeFile pull
docker compose -f $ComposeFile up -d --remove-orphans
docker compose -f $ComposeFile ps

Write-Host "[staging] done"
