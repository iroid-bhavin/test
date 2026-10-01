-- Runs on every shard database

CREATE TABLE IF NOT EXISTS orders (
  order_id      VARCHAR(64)    PRIMARY KEY,
  customer_id   VARCHAR(64)    NOT NULL,
  order_date    TIMESTAMPTZ    NOT NULL,
  order_amount  NUMERIC(12, 2) NOT NULL CHECK (order_amount >= 0),
  status        VARCHAR(20)    NOT NULL,
  upload_id     UUID,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Customer order history, newest first
CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders (customer_id, order_date DESC);

-- Date range reports
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders (order_date);
