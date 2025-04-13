import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { trpcRouter } from "../../trpc/router";


async function main() {
  const app = express();

  app.use(
    trpcExpress.createExpressMiddleware({
      router: trpcRouter,
    }),
  );

  app.listen(8000, () => {
    console.log("listening on port 8000");
  });
}

void main();
