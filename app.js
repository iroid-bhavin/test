require("dotenv").config();
const express = require("express");
const cors = require("cors");
const uploadRoutes = require("./routes/UploadRoute");
const orderRoutes = require("./routes/OrderRoute");
const healthRoutes = require("./routes/HealthRoute");
const { notFound, errorHandler } = require("./middleware/ErrorHandler");
const logger = require("./utils/Logger");

const app = express();
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", uploadRoutes);
app.use("/orders", orderRoutes);
app.use("/health", healthRoutes);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection", { error: error?.message });
});
