const test = require("node:test");
const assert = require("node:assert");
const { validateOrderRow } = require("../validations/OrderValidation");

const validRow = {
  order_id: "0b6c2f1e-6b7a-4b8e-9a37-2f1f5f4d9c11",
  customer_id: "CUST-0001",
  order_date: "2025-05-01T10:30:00Z",
  order_amount: "199.99",
  status: "Shipped",
};

test("valid row is accepted and normalized", () => {
  const { value, error } = validateOrderRow(validRow);

  assert.strictEqual(error, undefined);
  assert.strictEqual(value.order_amount, 199.99);
  assert.strictEqual(value.status, "shipped");
  assert.ok(value.order_date instanceof Date);
});

test("spec typo column order_amout is accepted", () => {
  const { order_amount, ...rest } = validRow;
  const { value, error } = validateOrderRow({ ...rest, order_amout: order_amount });

  assert.strictEqual(error, undefined);
  assert.strictEqual(value.order_amount, 199.99);
});

test("extra columns are dropped", () => {
  const { value } = validateOrderRow({ ...validRow, note: "gift" });
  assert.strictEqual(value.note, undefined);
});

test("invalid rows return a readable reason", () => {
  const cases = [
    { ...validRow, customer_id: "" },
    { ...validRow, order_date: "yesterday" },
    { ...validRow, order_amount: "-1" },
    { ...validRow, order_amount: "abc" },
    { ...validRow, status: "lost" },
    { ...validRow, order_id: "bad id with spaces" },
  ];

  cases.forEach((row) => {
    const { value, error } = validateOrderRow(row);
    assert.strictEqual(value, undefined);
    assert.ok(typeof error === "string" && error.length > 0);
  });
});
