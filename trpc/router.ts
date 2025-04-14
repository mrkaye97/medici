import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "./init";
import {
  checkAuth,
  createExpense,
  createExpenseLineItems,
  createMember,
  createPool,
  createPoolMembership,
  getExpense,
  getMember,
  getPoolDetails,
  listMembers,
  listMembersOfPool,
  listPoolRecentExpenses,
  listPoolsForMember,
  loginMember,
} from "../backend/src/db/query_sql";
import bcrypt from "bcrypt";

const PASSWORD_SALT = "$2b$10$dBUuuGRQ9bl2nOu/FkgVUe";
const DAYS = 1000 * 60 * 60 * 24;

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, PASSWORD_SALT);
};

type AuthResult =
  | {
      id: string;
      token: string;
      isAuthenticated: true;
      expiresAt: string;
    }
  | {
      id: null;
      token: null;
      isAuthenticated: false;
      expiresAt: null;
    };

export const healthRouter = createTRPCRouter({
  get: publicProcedure.query(() => {
    return { status: "ok" };
  }),
});

export const trpcRouter = createTRPCRouter({
  health: healthRouter,
  listMembers: publicProcedure.query(async ({ ctx }) => {
    return await listMembers(ctx.db);
  }),
  createPool: publicProcedure.input(z.object({
    name: z.string(),
    description: z.string(),
  })).mutation(async ({ctx, input}) => {
    return await createPool(ctx.db, {
      name: input.name,
      description: input.description,
    })
  }),
  createPoolMembership: publicProcedure.input(z.object({
    poolId: z.string(),
    memberId: z.string(),
  })).mutation(async ({ctx, input}) => {
    return await createPoolMembership(ctx.db, {
      poolId: input.poolId,
      memberId: input.memberId,
    })
  }),
  listMembersOfPool: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return await listMembersOfPool(ctx.db, { poolId: input });
    }),
  listPoolsForMember: publicProcedure
    .input(
      z.object({
        memberId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await listPoolsForMember(ctx.db, { memberId: input.memberId });
    }),
  getPoolDetails: publicProcedure
    .input(
      z.object({
        poolId: z.string(),
        memberId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await getPoolDetails(ctx.db, {
        poolid: input.poolId,
        memberid: input.memberId,
      });
    }),
  getPoolRecentExpenses: publicProcedure
    .input(
      z.object({
        poolId: z.string(),
        memberId: z.string(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await listPoolRecentExpenses(ctx.db, {
        poolId: input.poolId,
        debtorMemberId: input.memberId,
        expenselimit: input.limit || 5,
      });
    }),
  addExpense: publicProcedure
    .input(
      z.object({
        paidByMemberId: z.string(),
        poolId: z.string(),
        name: z.string(),
        amount: z.number(),
        lineItems: z.array(
          z.object({
            debtor_member_id: z.string(),
            amount: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expense = await createExpense(ctx.db, {
        poolId: input.poolId,
        paidByMemberId: input.paidByMemberId,
        name: input.name,
        amount: input.amount,
      });

      if (!expense) {
        throw new Error("Failed to create expense");
      }

      const expenseIds = input.lineItems.map((_) => expense.id);
      const debtorMemberIds = input.lineItems.map((li) => li.debtor_member_id);
      const amounts = input.lineItems.map((li) => li.amount);

      return await createExpenseLineItems(ctx.db, {
        expenseids: expenseIds,
        debtormemberids: debtorMemberIds,
        amounts: amounts,
      });
    }),
  getExpense: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const expense = await getExpense(ctx.db, { id: input });

    if (!expense) {
      throw new Error("Expense not found");
    }

    return expense;
  }),
  signup: publicProcedure
    .input(
      z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hashPassword(input.password);

      const createdMember = await createMember(ctx.db, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordhash: passwordHash,
      });

      if (!createdMember) {
        throw new Error("Failed to create member");
      }

      return await getMember(ctx.db, { id: createdMember.memberId });
    }),
  login: publicProcedure
    .input(
      z.object({
        email: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AuthResult> => {
      const passwordHash = await hashPassword(input.password);
      const auth = await loginMember(ctx.db, {
        email: input.email,
        passwordHash,
      });

      if (!auth || !auth.isAuthenticated) {
        return {
          id: null,
          token: null,
          isAuthenticated: false,
          expiresAt: null,
        };
      }

      return {
        id: auth.id,
        token: passwordHash,
        isAuthenticated: true,
        expiresAt: new Date(Date.now() + DAYS * 7).toISOString(),
      };
    }),
  authenticate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        token: z.string(),
        expiresAt: z.string(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AuthResult> => {
      const auth = await checkAuth(ctx.db, {
        memberId: input.id,
        passwordHash: input.token,
      });

      if (!auth || !auth.isAuthenticated) {
        return {
          id: null,
          token: null,
          isAuthenticated: false,
          expiresAt: null,
        };
      }

      return {
        id: auth.id,
        token: input.token,
        isAuthenticated: true,
        expiresAt: new Date(Date.now() + DAYS * 7).toISOString(),
      };
    }),
});

export type TRPCRouter = typeof trpcRouter;
