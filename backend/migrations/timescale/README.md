# TimescaleDB migration checkpoints

These scripts are intentionally manual while the V2.3 storage migration is
being verified one metric table at a time. They do not convert
`container_metrics` or `disk_metrics`.

## V2.3 Step 1B: `server_metrics`

Run from the repository root. Never use `docker compose down -v`.

### 1. Fresh backup and baseline

```bash
mkdir -p backups/v2.3-step1b
STEP1B_BACKUP="backups/v2.3-step1b/pre-server-metrics-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$STEP1B_BACKUP"
test -s "$STEP1B_BACKUP" && ls -lh "$STEP1B_BACKUP"
sha256sum "$STEP1B_BACKUP"

docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -P pager=off -c "SELECT COUNT(*) AS row_count, MIN(time) AS min_time, MAX(time) AS max_time FROM server_metrics;"'
```

Save the count and time range before continuing. Stop the backend temporarily
so metric ingestion cannot compete with the exclusive conversion lock:

```bash
docker compose stop backend
```

### 2. Convert and verify

```bash
docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/timescale/001_server_metrics_hypertable.sql \
  | tee backups/v2.3-step1b/server-metrics-conversion.log
```

The conversion and before/after checks run in one transaction. A count,
`min(time)`, or `max(time)` mismatch raises an exception and rolls back the
entire transaction. Review the output before enabling retention.

### 3. Add the 30-day retention policy

```bash
docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/timescale/002_server_metrics_retention.sql \
  | tee backups/v2.3-step1b/server-metrics-retention.log

docker compose start backend
```

The existing six-hour cleanup job remains active during Step 1B. Remove or
simplify it only after all three metric tables have been migrated and verified.

### 4. API verification

Obtain a valid access token and a server UUID, then compare these responses to
the pre-conversion responses:

```bash
curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://localhost:8080/api/v1/servers/$SERVER_ID/metrics/history?period=24h"

curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://localhost:8080/api/v1/network/dashboard?period=1h&server_id=$SERVER_ID"
```

### Rollback

Before the conversion transaction commits, any failure rolls it back
automatically. After a successful hypertable conversion, TimescaleDB does not
provide an in-place conversion back to a regular PostgreSQL table. The approved
rollback is therefore database restore from the fresh custom-format backup:

1. Stop `backend` to stop writes.
2. Restore into a separate empty database first and verify its row counts.
3. Switch only after the restored database is verified.

Do not drop the live database, table, volume, or hypertable as an improvised
rollback.

## V2.3 Step 1C: `container_metrics`

Run this checkpoint only after Step 1B has been reviewed. Take a new backup;
the Step 1B backup is not a substitute for this checkpoint.

### 1. Fresh backup and baseline

```bash
mkdir -p backups/v2.3-step1c
STEP1C_BACKUP="backups/v2.3-step1c/pre-container-metrics-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$STEP1C_BACKUP"
test -s "$STEP1C_BACKUP" && ls -lh "$STEP1C_BACKUP"
sha256sum "$STEP1C_BACKUP"

docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -P pager=off -c "SELECT COUNT(*) AS row_count, MIN(time) AS min_time, MAX(time) AS max_time FROM container_metrics;"'
```

Save the baseline output, then stop ingestion:

```bash
docker compose stop backend
```

### 2. Convert and verify

```bash
docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/timescale/003_container_metrics_hypertable.sql \
  | tee backups/v2.3-step1c/container-metrics-conversion.log
```

Do not continue unless the before/after count, `min(time)`, and `max(time)` are
identical and `container_metrics` appears in the hypertable result.

### 3. Add retention and restart ingestion

```bash
docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/timescale/004_container_metrics_retention.sql \
  | tee backups/v2.3-step1c/container-metrics-retention.log

docker compose start backend
```

### 4. API verification

```bash
curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://localhost:8080/api/v1/containers/$CONTAINER_ID/metrics/history?period=24h"

curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://localhost:8080/api/v1/databases/chart-data?period=1h"
```

The same rollback rule applies: before commit, SQL errors roll back the entire
conversion transaction. After commit, restore the verified backup into a
separate database and validate it before any switch. Never delete the live
table or Docker volume as a rollback method.

## V2.3 Step 1D: `disk_metrics`

Run this checkpoint only after Steps 1B and 1C have been reviewed. Take a new
backup immediately before the disk conversion.

### 1. Fresh backup and baseline

```bash
mkdir -p backups/v2.3-step1d
STEP1D_BACKUP="backups/v2.3-step1d/pre-disk-metrics-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$STEP1D_BACKUP"
test -s "$STEP1D_BACKUP" && ls -lh "$STEP1D_BACKUP"
sha256sum "$STEP1D_BACKUP"

docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -P pager=off -c "SELECT COUNT(*) AS row_count, MIN(time) AS min_time, MAX(time) AS max_time FROM disk_metrics;"'
```

Save the baseline output, then stop ingestion:

```bash
docker compose stop backend
```

### 2. Convert and verify

```bash
docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/timescale/005_disk_metrics_hypertable.sql \
  | tee backups/v2.3-step1d/disk-metrics-conversion.log
```

Do not continue unless the before/after count, `min(time)`, and `max(time)` are
identical and `disk_metrics` appears in the hypertable result.

### 3. Add retention and restart ingestion

```bash
docker compose exec -T postgres sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/timescale/006_disk_metrics_retention.sql \
  | tee backups/v2.3-step1d/disk-metrics-retention.log

docker compose start backend
```

### 4. API verification

```bash
curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://localhost:8080/api/v1/storage/dashboard?period=24h&server_id=$SERVER_ID"

curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://localhost:8080/api/v1/storage/consumers?server_id=$SERVER_ID&filesystem=all"
```

The same rollback rule applies. Do not remove the legacy cleanup scheduler
until all three hypertables and their retention policies have been verified on
the real database.
