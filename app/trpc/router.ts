import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from './init';
import { pool } from '../server/src/db/pool'
import { checkAuth, createMember, listMembers, listPoolsForMember, loginMember } from '../server/src/db/query_sql';
import bcrypt from 'bcrypt';

const PASSWORD_SALT = "$2b$10$dBUuuGRQ9bl2nOu/FkgVUe"
const DAYS = 1000 * 60 * 60 * 24;

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, PASSWORD_SALT);
};

type AuthResult = {
  id: string;
  token: string;
  isAuthenticated: true;
  expiresAt: string;
} | {
  id: null;
  token: null;
  isAuthenticated: false;
  expiresAt: null;
}

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
    signup: publicProcedure.input(z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      password: z.string(),
    })).mutation(async ({input}) => {
      const passwordHash = await hashPassword(input.password);
      const conn = await pool.connect()

      return await createMember(conn, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash
      })
    }),
    login: publicProcedure.input(z.object({
      email: z.string(),
      password: z.string(),
    })).mutation(async ({input}): Promise<AuthResult> => {
      const conn = await pool.connect()

      const passwordHash = await hashPassword(input.password);
      const auth = await loginMember(conn, {
        email: input.email,
        passwordHash,
      })

      if (!auth || !auth.isAuthenticated) {
        return {
          id: null,
          token: null,
          isAuthenticated: false,
          expiresAt: null,
        }
      }

      return {
        id: auth.id,
        token: passwordHash,
        isAuthenticated: true,
        expiresAt: new Date(Date.now() + DAYS * 7).toISOString(),
      }
    }),
    authenticate: publicProcedure.input(z.object({
      id: z.string(),
      token: z.string(),
      expiresAt: z.string(),
    })).query(async ({input}): Promise<AuthResult> => {
      const conn = await pool.connect()

      const auth = await checkAuth(conn, {
        id: input.id,
        passwordHash: input.token,
      })

      if (!auth || !auth.isAuthenticated) {
        return {
          id: null,
          token: null,
          isAuthenticated: false,
          expiresAt: null,
        }
      }

      return {
        id: auth.id,
        token: input.token,
        isAuthenticated: true,
        expiresAt: new Date(Date.now() + DAYS * 7).toISOString(),
      }
    })
  });

export type TRPCRouter = typeof trpcRouter;
