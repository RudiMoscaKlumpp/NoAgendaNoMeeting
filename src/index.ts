import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { router } from "./routes";
import { getDb } from "./db";
import { startPoller } from "./poller";
import { createLogger } from "./logger";

const log = createLogger("server");
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(router);

getDb();

app.listen(config.port, () => {
  log.info("Server started", { port: config.port });
  startPoller();
});
