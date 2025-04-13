import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { z } from "zod";

const t = initTRPC.context().create();

const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  hello: publicProcedure.input(z.string().nullish()).query(({ input, ctx }) => {
    return `hello ${input ?? "world"}`;
  }),
});

export type AppRouter = typeof appRouter;

async function main() {
  const app = express();

  app.use(
    trpcExpress.createExpressMiddleware({
      router: appRouter,
    }),
  );

  app.listen(8000, () => {
    console.log("listening on port 8000");
  });
}

void main();
