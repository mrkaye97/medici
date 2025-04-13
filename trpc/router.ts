import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from './init';
import { pool } from "../backend/src/db/pool"
import { checkAuth, createExpense, createExpenseLineItems, createMember, getMember, listMembers, listMembersOfPool, listPoolDetailsForMember, loginMember } from '../backend/src/db/query_sql';
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

      const pools = await listPoolDetailsForMember(conn, { memberid: input });
      const poolMembers = await Promise.all(pools.map(async (p) => {
        const m = await listMembersOfPool(conn, {poolId: p.id})

        return {
          poolId: p,
          members: m,
        }
      }));

      return { pools, poolMembers: poolMembers.map(pm => JSON.stringify(pm)) };
    }),
    addExpense: publicProcedure
    .input(z.object({
      paidByMemberId: z.string(),
      poolId: z.string(),
      name: z.string(),
      amount: z.number(),
      lineItems: z.array(z.object({
        debtor_member_id: z.string(),
        amount: z.number(),
      }))
    }))
    .mutation(async ({ input }) => {
      const conn = await pool.connect()

      console.log("Creating expense", input)

      const expense = await createExpense(conn, {
        poolId: input.poolId,
        paidByMemberId: input.paidByMemberId,
        name: input.name,
        amount: input.amount,
      })

      if (!expense) {
        throw new Error("Failed to create expense");
      }

      const expenseIds = input.lineItems.map((_) => expense.id)
      const debtorMemberIds = input.lineItems.map((li) => li.debtor_member_id)
      const amounts = input.lineItems.map((li) => li.amount)

      const lineItems = await createExpenseLineItems(conn, {
        expenseids: expenseIds,
        debtormemberids: debtorMemberIds,
        amounts: amounts,
      })

      console.log(expense, lineItems)
    }),
    signup: publicProcedure.input(z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      password: z.string(),
    })).mutation(async ({input}) => {
      const passwordHash = await hashPassword(input.password);
      const conn = await pool.connect()

      const createdMember = await createMember(conn, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordhash: passwordHash,
      })

      if (!createdMember) {
        throw new Error("Failed to create member");
      }

      return await getMember(conn, {id: createdMember.memberId})
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
        memberId: input.id,
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
