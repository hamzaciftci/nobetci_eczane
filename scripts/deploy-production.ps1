param(
  [string]$ComposeFile = "infra/deploy/docker-compose.production.yml",
  [string]$MigrationFile = "infra/postgres/migrations/20260220_sprint2.sql"
)

$ErrorActionPreference = "Stop"

Write-Host "[prod] install dependencies"
pnpm install --frozen-lockfile

Write-Host "[prod] quality gates"
pnpm typecheck
pnpm lint
pnpm build

if ($env:PRODUCTION_DATABASE_URL) {
  Write-Host "[prod] apply migration $MigrationFile"
  psql $env:PRODUCTION_DATABASE_URL -f $MigrationFile
} else {
  throw "PRODUCTION_DATABASE_URL is required for production deploy"
}

Write-Host "[prod] rolling deploy"
docker compose -f $ComposeFile pull
docker compose -f $ComposeFile up -d --remove-orphans
docker compose -f $ComposeFile ps

Write-Host "[prod] post-deploy smoke test"
if ($env:SKIP_SMOKE -ne "1") {
  pnpm smoke
}

Write-Host "[prod] done"
