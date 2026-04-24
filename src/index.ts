import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { router } from "./routes";
import { getDb } from "./db";
import { startPoller } from "./poller";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(router);

getDb();

app.listen(config.port, () => {
  console.log(`No Agenda? No Meeting running on port ${config.port}`);
  startPoller();
});
