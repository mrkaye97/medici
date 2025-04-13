import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { pool } from '../backend/src/db/pool';

export async function createContext(_opts: CreateExpressContextOptions) {
  return {};
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const withDb = t.middleware(async ({ next }) => {
  const conn = await pool.connect();
  try {
    return next({
      ctx: {
        db: conn,
      },
    });
  } finally {
    conn.release();
  }
});


export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(withDb)
