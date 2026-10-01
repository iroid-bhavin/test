-- Runs on the meta database only

CREATE TABLE IF NOT EXISTS uploads (
  id              UUID         PRIMARY KEY,
  file_name       TEXT         NOT NULL,
  gcs_uri         TEXT,
  status          VARCHAR(20)  NOT NULL,
  total_rows      INTEGER      NOT NULL DEFAULT 0,
  inserted_rows   INTEGER      NOT NULL DEFAULT 0,
  duplicate_rows  INTEGER      NOT NULL DEFAULT 0,
  failed_rows     INTEGER      NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Invalid rows are kept here so they can be reviewed and fixed later
CREATE TABLE IF NOT EXISTS failed_rows (
  id          BIGSERIAL    PRIMARY KEY,
  upload_id   UUID         NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  row_number  INTEGER      NOT NULL,
  raw_data    JSONB        NOT NULL,
  reason      TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_rows_upload ON failed_rows (upload_id, row_number);
