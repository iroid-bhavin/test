// Usage: node scripts/generateOrders.js [rows] [outputFile]
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ORDER_STATUSES } = require("../validations/OrderValidation");

const rowCount = Number(process.argv[2]) || 10000;
const outputFile = process.argv[3] || path.join(__dirname, "../sample/orders.csv");

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomDate = () => new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();

// About 1% of rows are broken on purpose to show validation
const badRow = () =>
  pick([
    [crypto.randomUUID(), "", randomDate(), "10.00", "pending"],
    [crypto.randomUUID(), "CUST-0001", "not-a-date", "10.00", "pending"],
    [crypto.randomUUID(), "CUST-0001", randomDate(), "-5", "pending"],
    [crypto.randomUUID(), "CUST-0001", randomDate(), "abc", "unknown"],
  ]);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
const out = fs.createWriteStream(outputFile);
out.write("order_id,customer_id,order_date,order_amount,status\n");

for (let i = 0; i < rowCount; i++) {
  const row =
    Math.random() < 0.01
      ? badRow()
      : [
          crypto.randomUUID(),
          `CUST-${String(Math.ceil(Math.random() * 1000)).padStart(4, "0")}`,
          randomDate(),
          (Math.random() * 1000 + 1).toFixed(2),
          pick(ORDER_STATUSES),
        ];
  out.write(row.join(",") + "\n");
}

out.end(() => console.log(`Wrote ${rowCount} rows to ${outputFile}`));
