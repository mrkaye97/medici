import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { trpcRouter } from "../../trpc/router";
import cors from "cors";


async function main() {
  const app = express();

  app.use(cors({
    origin: "*",
    allowedHeaders: "*",
  }))

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  app.use(
    trpcExpress.createExpressMiddleware({
      router: trpcRouter,
    }),
  );

  app.listen(8000, () => {
    console.log("listening on port 8000");
  });
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
