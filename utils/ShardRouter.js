const crypto = require("crypto");

// Same customer always maps to the same shard
const getShardIndex = (customerId, shardCount) => {
  const hash = crypto.createHash("md5").update(String(customerId)).digest();
  return hash.readUInt32BE(0) % shardCount;
};

module.exports = { getShardIndex };
