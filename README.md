# Orders Ingestion Service

Node.js + Express service that accepts an orders CSV (~10,000 rows), stores the file in Google Cloud Storage using Application Default Credentials (ADC), then streams, validates and batch-inserts the rows into a **sharded PostgreSQL** setup.

## Flow

```
POST /upload-orders (CSV)
   │  multer writes the file to a temp file on disk (never fully in memory)
   ▼
uploads row created (status: uploading)
   │
   ▼
File streamed to GCS  ──fail──▶  502 + upload marked "failed"
   │
   ▼
202 Accepted { uploadId }       ◀── client polls GET /uploads/:uploadId
   │
   ▼  background queue
Stream CSV row by row ─▶ validate (Joi) ─▶ route to shard by customer_id
   │                         │
   │                         └─ invalid ─▶ failed_rows table + log
   ▼
Batch of 500 per shard ─▶ one INSERT ... UNNEST inside a transaction (with retry)
   │
   ▼
uploads row updated (completed / failed + counts)
```

## Project structure

```
app.js                      Express setup
config/connection.js        Sequelize instances (meta + one per shard) and models
controllers/                Request handlers (upload, orders, health)
routes/                     Route definitions
middleware/                 Joi validation, multer upload, error handler
models/                     Sequelize model definitions + data access for orders and uploads
services/StorageService.js  GCS upload via ADC
services/OrderImportService.js  Streaming parse, validation, batching, shard routing
jobs/ImportQueue.js         Background job queue
validations/                Joi schemas (CSV row + request params)
utils/                      Shard router, retry, logger
db/init/                    Creates the databases in docker-compose
scripts/                    migrate (sequelize.sync) + sample data generator
tests/                      Unit tests (node:test)
```

## Setup

### Requirements

- Node.js 20+ (tested on 24)
- PostgreSQL 14+ (or Docker)
- Google Cloud SDK (`gcloud`) and a GCS bucket

### 1. Configure Google ADC

No key files are used or committed. The `@google-cloud/storage` client finds credentials automatically through ADC.

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default login

# create a bucket if you don't have one
gcloud storage buckets create gs://YOUR_BUCKET --location=asia-south1
```

The logged-in account needs `roles/storage.objectCreator` (or `objectAdmin`) on the bucket.

When deployed (Cloud Run / GKE), skip the login: attach a service account through workload identity and ADC picks it up with no code change.

### 2. Environment

```bash
cp .env.example .env
```

Set `GCP_PROJECT_ID`, `GCS_BUCKET_NAME`, `META_DATABASE_URL` and `SHARD_URLS`.

### 3a. Run with Docker (recommended)

```bash
# Linux / macOS (ADC file lives in ~/.config/gcloud)
GCP_PROJECT_ID=xxx GCS_BUCKET_NAME=yyy docker compose up --build
```

```powershell
# Windows (ADC file lives in %APPDATA%\gcloud)
$env:GCLOUD_CONFIG_DIR="$env:APPDATA\gcloud"; $env:GCP_PROJECT_ID="xxx"; $env:GCS_BUCKET_NAME="yyy"
docker compose up --build
```

This starts PostgreSQL with 4 databases (`orders_meta`, `orders_shard_0..2`), runs migrations, and starts the API on port 3000. The ADC file is mounted read-only into the container.

### 3b. Run locally

Create the databases (see `db/init/create-databases.sql`), then:

```bash
npm install
npm run migrate
npm run dev
```

### 4. Try it

```bash
npm run generate:orders            # writes sample/orders.csv (10,000 rows, ~1% invalid)

curl -F "file=@sample/orders.csv" http://localhost:3000/upload-orders
curl http://localhost:3000/uploads/<uploadId>
curl "http://localhost:3000/orders?customerId=CUST-0001"
curl http://localhost:3000/orders/<orderId>
curl http://localhost:3000/health
```

### Tests

```bash
npm test
```

## API

| Method | Path | Description |
|---|---|---|
| POST | `/upload-orders` | multipart/form-data, field `file` (.csv). Uploads to GCS, queues processing, returns `202` with `uploadId` |
| GET | `/uploads/:uploadId` | Processing status, row counts and up to 100 failed rows with reasons |
| GET | `/orders/:orderId` | Single order. Optional `?customerId=` routes straight to one shard |
| GET | `/orders?customerId=` | Orders of a customer, newest first. `limit` (max 500) and `offset` supported |
| GET | `/health` | DB status per shard, uptime, pending import jobs |

### CSV format

```csv
order_id,customer_id,order_date,order_amount,status
0b6c2f1e-6b7a-4b8e-9a37-2f1f5f4d9c11,CUST-0001,2025-05-01T10:30:00Z,199.99,shipped
```

- `order_id`: UUID or any id of letters, digits, `-`, `_` (max 64)
- `order_date`: ISO 8601
- `order_amount`: number ≥ 0, 2 decimals (`order_amout` header from the spec is also accepted)
- `status`: `pending | confirmed | shipped | delivered | cancelled | returned` (case-insensitive)

Extra columns are ignored. Invalid rows are skipped, logged, and stored in `failed_rows` with the reason.

## Sharding strategy

**Approach:** application-level sharding across multiple PostgreSQL databases.

**Shard key:** `customer_id`.

**Routing:** `shard = md5(customer_id) first 4 bytes % number_of_shards` (`utils/ShardRouter.js`). Shards are listed in `SHARD_URLS`; their position in that list is the shard number.

Why `customer_id`:

- The most common read, "orders of a customer", hits exactly **one** shard.
- All orders of a customer live together, so per-customer reports need no cross-shard joins.
- md5 spreads customers evenly (covered by a unit test), so no single shard gets hot from sequential ids.

How inserts land on the right shard: each validated row is routed by its `customer_id` into that shard's in-memory batch. When a batch reaches `BATCH_SIZE` it's written to that shard's pool only.

Lookup by `order_id` alone does not know the shard, so it queries all shards **in parallel** and returns the match. With a few shards this is cheap; passing `?customerId=` skips the fan-out.

The meta database (`uploads`, `failed_rows`) is separate from the shards because it's small, low-traffic job bookkeeping, not order data.

## Design decisions & trade-offs

- **Streaming, not buffering.** Multer writes to disk, GCS upload streams from disk, `csv-parse` reads row by row, and `for await` pauses the stream while a batch is being written (natural backpressure). Importing 10k rows uses ~12 MB of heap.
- **Batch insert with Sequelize.** One multi-row `INSERT ... ON CONFLICT DO NOTHING RETURNING order_id` per batch (Sequelize `bulkInsert` with `ignoreDuplicates`), inside a transaction. `RETURNING` gives the exact number of new rows. Sequelize inlines escaped values, so there is no 65k bind-parameter limit.
- **Idempotency.** `order_id` is the primary key and inserts use `ON CONFLICT DO NOTHING`. Re-uploading the same file (or retrying a batch) never creates duplicates; the duplicate count is reported in the upload status.
- **Retry.** Each batch insert retries 3 times with exponential backoff. If it still fails, those rows go to `failed_rows` with the DB error instead of aborting the whole file.
- **Background processing.** The API responds `202` as soon as the file is safely in GCS; parsing and inserting run in a queue. Status is persisted in `uploads` so it survives restarts and is visible from any instance.
- **Validation errors are data, not exceptions.** Bad rows don't stop the import; they're counted, logged, and stored with the raw row for later fixing.
- **Data types.** `NUMERIC(12,2)` for money (no float rounding), `TIMESTAMPTZ` for dates, `VARCHAR(64)` ids so both UUIDs and business ids work. Composite index `(customer_id, order_date DESC)` serves the customer listing query directly.

### Known limitations

- **Modulo sharding and resharding.** Adding a shard changes `hash % N` for most customers, so data must be moved. A production version would use consistent hashing or a fixed number of virtual buckets mapped to physical shards.
- **`order_id` uniqueness is per shard.** If the same `order_id` arrives with a different `customer_id`, it lands on another shard and both are stored. A global id registry or sharding by `order_id` would prevent this, at the cost of customer queries fanning out.
- **In-process queue.** Jobs live in memory; if the process restarts mid-import, the upload stays `processing`. Since the file is in GCS and inserts are idempotent, re-uploading is safe. A production setup would use Pub/Sub, Cloud Tasks or BullMQ with workers reading from GCS.
- **CSV only** (the spec allows choosing CSV or Excel).
- **Docker runs all shards in one Postgres server** for convenience. In production each `SHARD_URLS` entry points to its own server.
