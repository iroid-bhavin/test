const { Sequelize } = require("sequelize");
const { getShardIndex } = require("../utils/ShardRouter");
const defineUpload = require("../models/definitions/Upload");
const defineFailedRow = require("../models/definitions/FailedRow");
const defineOrder = require("../models/definitions/Order");

const shardUrls = (process.env.SHARD_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

if (!process.env.META_DATABASE_URL || shardUrls.length === 0) {
  throw new Error("META_DATABASE_URL and SHARD_URLS must be set in .env");
}

const createSequelize = (url, maxConnections) =>
  new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { max: maxConnections, min: 0, idle: 10000 },
  });

// Meta DB keeps upload jobs and failed rows, shards keep orders
const metaDb = createSequelize(process.env.META_DATABASE_URL, 5);
const Upload = defineUpload(metaDb);
const FailedRow = defineFailedRow(metaDb);
Upload.hasMany(FailedRow, { foreignKey: "upload_id", onDelete: "CASCADE" });
FailedRow.belongsTo(Upload, { foreignKey: "upload_id" });

// Every shard gets its own Sequelize instance and its own Order model
const shards = shardUrls.map((url) => {
  const sequelize = createSequelize(url, 10);
  return { sequelize, Order: defineOrder(sequelize) };
});

const getShard = (customerId) => shards[getShardIndex(customerId, shards.length)];

const closeAll = () => Promise.all([metaDb, ...shards.map((shard) => shard.sequelize)].map((db) => db.close()));

module.exports = {
  metaDb,
  Upload,
  FailedRow,
  shards,
  getShard,
  closeAll,
};
