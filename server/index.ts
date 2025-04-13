import express from 'express';
import { z } from "zod";
import * as trpcExpress from '@trpc/server/adapters/express';
import { initTRPC } from "@trpc/server";
import { db } from './db';
import { publicProcedure } from './trpc';

const createContext = () => ({}); // no context
type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create();

const appRouter = t.router({
  userList: publicProcedure
    .query(async () => {
      const users = await db.user.findMany();
      return users;
    }),
  userById: publicProcedure
    .input(z.string())
    .query(async (opts) => {
      const { input } = opts;
      const user = await db.user.findById(input);
      return user;
    }),
  userCreate: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      const user = await db.user.create(input);
      return user;
    }),
});

export type AppRouter = typeof appRouter;

const app = express();

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(4000);
