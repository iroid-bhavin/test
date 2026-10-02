# Orders Service

Upload a CSV of orders. The file is saved to Google Cloud Storage, then the rows are checked and stored in PostgreSQL. Orders are split across 3 databases (shards) by `customer_id`.

Built with Node.js, Express, Sequelize and PostgreSQL.

## How it works

1. `POST /upload-orders` receives the CSV and saves it to Google Cloud Storage.
2. The API answers right away with an `uploadId`. The rows are processed in the background.
3. Each row is validated. Valid rows are inserted in batches of 500 into the shard that belongs to the customer. Invalid rows are saved in the `failed_rows` table with the reason.
4. `GET /uploads/:uploadId` shows the progress and counts.

Uploading the same file again does not create duplicates, because `order_id` is unique.

## Requirements

- Node.js 20+
- Docker, or PostgreSQL 14+
- A Google Cloud project with a storage bucket

## Setup

### 1. Google Cloud login

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default login
gcloud storage buckets create gs://YOUR_BUCKET
```

The last login creates `application_default_credentials.json` (on Windows in `%APPDATA%\gcloud`). Copy that file into the project root. It is git-ignored.

### 2. Environment

```bash
cp .env.example .env
```

Set `GCP_PROJECT_ID` and `GCS_BUCKET_NAME` in `.env`.

### 3. Run with Docker

```bash
docker compose up --build
```

This starts PostgreSQL, creates the tables and starts the API on port 3000.

### 3. Or run locally

Create the databases in `db/init/create-databases.sql`, set the database URLs in `.env`, then:

```bash
npm install
npm run migrate
npm run dev
```

`npm run migrate` creates the tables.

## Try it

```bash
npm run generate:orders
curl -F "file=@orders.csv" http://localhost:3000/upload-orders
curl http://localhost:3000/uploads/<uploadId>
curl "http://localhost:3000/orders?customerId=CUST-0001"
curl http://localhost:3000/health
```

`npm run generate:orders` writes `orders.csv` with 10,000 fake rows. About 1% are invalid on purpose.

Run the tests with `npm test`.

## API

| Method | Path | What it does |
|---|---|---|
| POST | `/upload-orders` | Upload a `.csv` (form field `file`) |
| GET | `/uploads/:uploadId` | Upload status, row counts, first 100 failed rows |
| GET | `/orders?customerId=` | Orders of one customer, newest first. Optional `limit` (max 500) and `offset` |
| GET | `/orders/:orderId` | One order. Add `?customerId=` to make it faster |
| GET | `/health` | Database status, uptime, pending imports |

## CSV format

```csv
order_id,customer_id,order_date,order_amount,status
0b6c2f1e-6b7a-4b8e-9a37-2f1f5f4d9c11,CUST-0001,2025-05-01T10:30:00Z,199.99,shipped
```

- `order_id`: letters, numbers, `-` or `_`, up to 64 characters
- `order_date`: ISO 8601 date
- `order_amount`: number from 0, up to 2 decimals
- `status`: pending, confirmed, shipped, delivered, cancelled or returned

Extra columns are ignored.

## Sharding

Orders are stored in 3 databases. The shard is picked from the customer id:

```
shard = md5(customer_id) → number → % 3
```

The same customer always goes to the same shard, so "orders of a customer" reads from one database only. Looking up an order without `customerId` searches all 3 shards.

The shard order in `SHARD_URLS` must not change once there is data. Changing it or adding a shard moves customers to different shards.

Uploads and failed rows are kept in a separate meta database (`orders_meta`).

## Project folders

```
config/       database connections
models/       Sequelize models and queries
controllers/  request handlers
routes/       URLs
services/     Google Cloud upload, CSV import
jobs/         background import queue
validations/  Joi checks
scripts/      migrate, generate test CSV
tests/        unit tests
```
