const express = require("express");
const router = express.Router();
const { getHealth } = require("../controllers/HealthController");

router.get("/", getHealth);

module.exports = router;
