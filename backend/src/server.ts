import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { trpcRouter } from "../../trpc/router";
import cors from "cors";

async function main() {
  const app = express();

  app.use(
    cors({
      origin: "http://localhost:3001", // more restrictive than "*"
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "trpc-accept"],
    }),
  );

  app.options("*", cors());

  app.use(
    "/api/trpc",
    trpcExpress.createExpressMiddleware({
      router: trpcRouter,
      onError({ error, path, type }) {
        console.error(`tRPC Error on ${type} ${path}:`, error);
      },
    }),
  );

  app.use((req, res, next) => {
    const timeout = setTimeout(() => {
      console.warn(`⚠️  Slow request: ${req.method} ${req.path}`);
    }, 2000);

    res.on("finish", () => clearTimeout(timeout));
    next();
  });

  app.listen(8000, () => {
    console.log("listening on port 8000");
  });
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
