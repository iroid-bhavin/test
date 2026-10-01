const test = require("node:test");
const assert = require("node:assert");
const { getShardIndex } = require("../utils/ShardRouter");

test("same customer always goes to the same shard", () => {
  const first = getShardIndex("CUST-0042", 3);
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(getShardIndex("CUST-0042", 3), first);
  }
});

test("shard index is always within range", () => {
  for (let i = 0; i < 1000; i++) {
    const index = getShardIndex(`CUST-${i}`, 3);
    assert.ok(index >= 0 && index < 3);
  }
});

test("customers are spread evenly across shards", () => {
  const counts = [0, 0, 0];
  for (let i = 0; i < 9000; i++) counts[getShardIndex(`CUST-${i}`, 3)]++;

  // each shard should get roughly a third (3000 +/- 10%)
  counts.forEach((count) => assert.ok(count > 2700 && count < 3300, `uneven: ${counts}`));
});
