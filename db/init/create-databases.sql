-- Used by docker-compose. In production each shard would live on its own server.
CREATE DATABASE orders_meta;
CREATE DATABASE orders_shard_0;
CREATE DATABASE orders_shard_1;
CREATE DATABASE orders_shard_2;
