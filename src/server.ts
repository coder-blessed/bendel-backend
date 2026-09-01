import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import router from "./routes/index.js";

const app = express();
const port = env.port;

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/api", router);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal server error." });
});

app.listen(port, () => {
  console.log(`Bendel backend running on http://localhost:${port}`);
});
