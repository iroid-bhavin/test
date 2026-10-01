const { metaDb, shards } = require("../config/connection");
const ImportQueue = require("../jobs/ImportQueue");

const ping = async (sequelize) => {
  try {
    await sequelize.authenticate();
    return "up";
  } catch {
    return "down";
  }
};

const getHealth = async (req, res) => {
  const [meta, ...shardStates] = await Promise.all([metaDb, ...shards.map((shard) => shard.sequelize)].map(ping));
  const healthy = meta === "up" && shardStates.every((state) => state === "up");

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      meta,
      shards: shardStates.map((state, index) => ({ shard: index, state })),
    },
    importJobsPending: ImportQueue.size(),
  });
};

module.exports = { getHealth };
