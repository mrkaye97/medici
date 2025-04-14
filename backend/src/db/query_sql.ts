import { QueryArrayConfig, QueryArrayResult } from "pg";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const getMemberQuery = `-- name: GetMember :one
SELECT m.id, m.first_name, m.last_name, m.email, m.inserted_at, m.updated_at, p.password_hash
FROM member m
JOIN member_password p ON m.id = p.member_id
WHERE m.id = $1`;

export interface GetMemberArgs {
    id: string;
}

export interface GetMemberRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    insertedAt: Date;
    updatedAt: Date;
    passwordHash: string;
}

export async function getMember(client: Client, args: GetMemberArgs): Promise<GetMemberRow | null> {
    const result = await client.query({
        text: getMemberQuery,
        values: [args.id],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        firstName: row[1],
        lastName: row[2],
        email: row[3],
        insertedAt: row[4],
        updatedAt: row[5],
        passwordHash: row[6]
    };
}

export const listMembersQuery = `-- name: ListMembers :many
SELECT id, first_name, last_name, email, inserted_at, updated_at
FROM member`;

export interface ListMembersRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function listMembers(client: Client): Promise<ListMembersRow[]> {
    const result = await client.query({
        text: listMembersQuery,
        values: [],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            firstName: row[1],
            lastName: row[2],
            email: row[3],
            insertedAt: row[4],
            updatedAt: row[5]
        };
    });
}

export const listPoolsForMemberQuery = `-- name: ListPoolsForMember :many
SELECT p.id, p.name, p.description, p.inserted_at, p.updated_at
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id
WHERE pm.member_id = $1`;

export interface ListPoolsForMemberArgs {
    memberId: string;
}

export interface ListPoolsForMemberRow {
    id: string;
    name: string;
    description: string | null;
    insertedAt: Date;
    updatedAt: Date;
}

export async function listPoolsForMember(client: Client, args: ListPoolsForMemberArgs): Promise<ListPoolsForMemberRow[]> {
    const result = await client.query({
        text: listPoolsForMemberQuery,
        values: [args.memberId],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            name: row[1],
            description: row[2],
            insertedAt: row[3],
            updatedAt: row[4]
        };
    });
}

export const getPoolDetailsQuery = `-- name: GetPoolDetails :one
WITH debts_owed AS (
    SELECT
        eli.debtor_member_id,
        e.pool_id,
        SUM(eli.amount)::DOUBLE PRECISION AS total_debt
    FROM expense_line_item eli
    JOIN expense e ON (e.id, eli.is_settled) = (eli.expense_id, false)
    WHERE
        eli.debtor_member_id = $1::UUID
    GROUP BY eli.debtor_member_id, e.pool_id
)

SELECT
    $1::UUID AS member_id,
    p.id,
    p.name,
    p.description,
    COALESCE(d.total_debt, 0.0)::DOUBLE PRECISION AS total_debt,
    p.inserted_at,
    p.updated_at
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = $1::UUID
LEFT JOIN debts_owed d ON d.pool_id = p.id
WHERE p.id = $2::UUID`;

export interface GetPoolDetailsArgs {
    memberid: string;
    poolid: string;
}

export interface GetPoolDetailsRow {
    memberId: string;
    id: string;
    name: string;
    description: string | null;
    totalDebt: number;
    insertedAt: Date;
    updatedAt: Date;
}

export async function getPoolDetails(client: Client, args: GetPoolDetailsArgs): Promise<GetPoolDetailsRow | null> {
    const result = await client.query({
        text: getPoolDetailsQuery,
        values: [args.memberid, args.poolid],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        memberId: row[0],
        id: row[1],
        name: row[2],
        description: row[3],
        totalDebt: row[4],
        insertedAt: row[5],
        updatedAt: row[6]
    };
}

export const listMembersOfPoolQuery = `-- name: ListMembersOfPool :many
SELECT m.id, m.first_name, m.last_name, m.email, m.inserted_at, m.updated_at
FROM member m
JOIN pool_membership pm ON m.id = pm.member_id
WHERE pm.pool_id = $1`;

export interface ListMembersOfPoolArgs {
    poolId: string;
}

export interface ListMembersOfPoolRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function listMembersOfPool(client: Client, args: ListMembersOfPoolArgs): Promise<ListMembersOfPoolRow[]> {
    const result = await client.query({
        text: listMembersOfPoolQuery,
        values: [args.poolId],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            firstName: row[1],
            lastName: row[2],
            email: row[3],
            insertedAt: row[4],
            updatedAt: row[5]
        };
    });
}

export const listPoolRecentExpensesQuery = `-- name: ListPoolRecentExpenses :many
SELECT
    e.id,
    e.name,
    e.amount::DOUBLE PRECISION AS amount,
    e.is_settled,
    e.inserted_at,
    e.updated_at,
    e.pool_id,
    e.paid_by_member_id,
    eli.amount::DOUBLE PRECISION AS amount_owed
FROM expense e
JOIN expense_line_item eli ON (e.id, e.is_settled) = (eli.expense_id, false) AND eli.debtor_member_id = $1
WHERE
    e.pool_id = $2
    AND e.is_settled = FALSE
ORDER BY e.inserted_at DESC
LIMIT $3::INTEGER`;

export interface ListPoolRecentExpensesArgs {
    debtorMemberId: string;
    poolId: string;
    expenselimit: number;
}

export interface ListPoolRecentExpensesRow {
    id: string;
    name: string;
    amount: number;
    isSettled: boolean;
    insertedAt: Date;
    updatedAt: Date;
    poolId: string;
    paidByMemberId: string;
    amountOwed: number;
}

export async function listPoolRecentExpenses(client: Client, args: ListPoolRecentExpensesArgs): Promise<ListPoolRecentExpensesRow[]> {
    const result = await client.query({
        text: listPoolRecentExpensesQuery,
        values: [args.debtorMemberId, args.poolId, args.expenselimit],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            name: row[1],
            amount: row[2],
            isSettled: row[3],
            insertedAt: row[4],
            updatedAt: row[5],
            poolId: row[6],
            paidByMemberId: row[7],
            amountOwed: row[8]
        };
    });
}

export const getExpenseQuery = `-- name: GetExpense :one
SELECT
    e.id,
    e.name,
    e.amount::DOUBLE PRECISION AS amount,
    e.is_settled,
    e.inserted_at,
    e.updated_at,
    e.pool_id,
    e.paid_by_member_id
FROM expense e
WHERE id = $1`;

export interface GetExpenseArgs {
    id: string;
}

export interface GetExpenseRow {
    id: string;
    name: string;
    amount: number;
    isSettled: boolean;
    insertedAt: Date;
    updatedAt: Date;
    poolId: string;
    paidByMemberId: string;
}

export async function getExpense(client: Client, args: GetExpenseArgs): Promise<GetExpenseRow | null> {
    const result = await client.query({
        text: getExpenseQuery,
        values: [args.id],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        name: row[1],
        amount: row[2],
        isSettled: row[3],
        insertedAt: row[4],
        updatedAt: row[5],
        poolId: row[6],
        paidByMemberId: row[7]
    };
}

export const loginMemberQuery = `-- name: LoginMember :one
SELECT
    m.id,
    m.email,
    p.password_hash = $2 AS is_authenticated
FROM member m
JOIN member_password p ON m.id = p.member_id
WHERE m.email = $1`;

export interface LoginMemberArgs {
    email: string;
    passwordHash: string;
}

export interface LoginMemberRow {
    id: string;
    email: string;
    isAuthenticated: boolean;
}

export async function loginMember(client: Client, args: LoginMemberArgs): Promise<LoginMemberRow | null> {
    const result = await client.query({
        text: loginMemberQuery,
        values: [args.email, args.passwordHash],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        email: row[1],
        isAuthenticated: row[2]
    };
}

export const checkAuthQuery = `-- name: CheckAuth :one
SELECT
    id,
    password_hash = $1 AS is_authenticated
FROM member_password
WHERE member_id = $2`;

export interface CheckAuthArgs {
    passwordHash: string;
    memberId: string;
}

export interface CheckAuthRow {
    id: string;
    isAuthenticated: boolean;
}

export async function checkAuth(client: Client, args: CheckAuthArgs): Promise<CheckAuthRow | null> {
    const result = await client.query({
        text: checkAuthQuery,
        values: [args.passwordHash, args.memberId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        isAuthenticated: row[1]
    };
}

export const createMemberQuery = `-- name: CreateMember :one
WITH m AS (
    INSERT INTO member (first_name, last_name, email)
    VALUES ($1, $2, $3)
    RETURNING id
)
INSERT INTO member_password (member_id, password_hash)
VALUES (
    (SELECT id FROM m),
    $4::TEXT
)
RETURNING member_id`;

export interface CreateMemberArgs {
    firstName: string;
    lastName: string;
    email: string;
    passwordhash: string;
}

export interface CreateMemberRow {
    memberId: string;
}

export async function createMember(client: Client, args: CreateMemberArgs): Promise<CreateMemberRow | null> {
    const result = await client.query({
        text: createMemberQuery,
        values: [args.firstName, args.lastName, args.email, args.passwordhash],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        memberId: row[0]
    };
}

export const createExpenseQuery = `-- name: CreateExpense :one
INSERT INTO expense (pool_id, paid_by_member_id, name, amount)
VALUES ($1, $2, $3, $4::DOUBLE PRECISION)
RETURNING id, pool_id, paid_by_member_id, name, amount, is_settled, inserted_at, updated_at`;

export interface CreateExpenseArgs {
    poolId: string;
    paidByMemberId: string;
    name: string;
    amount: number;
}

export interface CreateExpenseRow {
    id: string;
    poolId: string;
    paidByMemberId: string;
    name: string;
    amount: string;
    isSettled: boolean;
    insertedAt: Date;
    updatedAt: Date;
}

export async function createExpense(client: Client, args: CreateExpenseArgs): Promise<CreateExpenseRow | null> {
    const result = await client.query({
        text: createExpenseQuery,
        values: [args.poolId, args.paidByMemberId, args.name, args.amount],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        poolId: row[1],
        paidByMemberId: row[2],
        name: row[3],
        amount: row[4],
        isSettled: row[5],
        insertedAt: row[6],
        updatedAt: row[7]
    };
}

export const createExpenseLineItemsQuery = `-- name: CreateExpenseLineItems :many
WITH input AS (
    SELECT
        UNNEST($1::UUID[]) AS expense_ids,
        UNNEST($2::UUID[]) AS debtor_member_ids,
        UNNEST($3::DOUBLE PRECISION[]) AS amounts
)

INSERT INTO expense_line_item (expense_id, debtor_member_id, amount)
SELECT
    i.expense_ids,
    i.debtor_member_ids,
    i.amounts
FROM input i
RETURNING id, expense_id, debtor_member_id, is_settled, amount, inserted_at, updated_at`;

export interface CreateExpenseLineItemsArgs {
    expenseids: string[];
    debtormemberids: string[];
    amounts: number[];
}

export interface CreateExpenseLineItemsRow {
    id: string;
    expenseId: string;
    debtorMemberId: string;
    isSettled: boolean;
    amount: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function createExpenseLineItems(client: Client, args: CreateExpenseLineItemsArgs): Promise<CreateExpenseLineItemsRow[]> {
    const result = await client.query({
        text: createExpenseLineItemsQuery,
        values: [args.expenseids, args.debtormemberids, args.amounts],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            expenseId: row[1],
            debtorMemberId: row[2],
            isSettled: row[3],
            amount: row[4],
            insertedAt: row[5],
            updatedAt: row[6]
        };
    });
}

