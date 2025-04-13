import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from './init';
import { pool } from '../server/src/db/pool'
import { listMembers, listPoolsForMember } from '../server/src/db/query_sql';

export const trpcRouter = createTRPCRouter({
  listMembers: publicProcedure.query(async () => {
    const conn = await pool.connect();

    return await listMembers(conn);
  }),
  listPoolsForMember: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const conn = await pool.connect();

      return await listPoolsForMember(conn, { memberId: input });
    }),
  });

export type TRPCRouter = typeof trpcRouter;
