require("dotenv").config();
const { metaDb, shards, closeAll } = require("../config/connection");
const logger = require("../utils/Logger");

// sync() creates missing tables and indexes from the model definitions.
// It never drops or alters existing tables.
const migrate = async () => {
  await metaDb.sync();
  logger.info("Meta schema ready");

  for (const [index, { sequelize }] of shards.entries()) {
    await sequelize.sync();
    // Not expressible in a model definition, so added once by hand
    await sequelize.query(`
      DO $$ BEGIN
        ALTER TABLE orders ADD CONSTRAINT orders_order_amount_check CHECK (order_amount >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    logger.info("Shard schema ready", { shard: index });
  }
};

migrate()
  .catch((error) => {
    logger.error("Migration failed", { error: error.message });
    process.exitCode = 1;
  })
  .finally(closeAll);
