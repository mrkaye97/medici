import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { z } from "zod";
import { pool } from "./db/pool";
import { listMembers } from "./db/query_sql";

const t = initTRPC.context().create();

const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  members: publicProcedure.query(async ({ input }) => {
    const conn = await pool.connect()

    return await listMembers(conn)
  }),
  pools: publicProcedure.input(z.string()).query(({ memberId }) => {
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
