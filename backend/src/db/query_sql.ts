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

export const listFriendPoolMembershipStatusQuery = `-- name: ListFriendPoolMembershipStatus :many
WITH friends AS (
    SELECT
        CASE
            WHEN f.inviting_member_id = $2::UUID THEN f.friend_member_id
            WHEN f.friend_member_id = $2::UUID THEN f.inviting_member_id
        END AS member_id
    FROM friendship f
    WHERE
        (f.inviting_member_id = $2::UUID OR f.friend_member_id = $2::UUID)
        AND f.status = 'accepted'

    UNION

    SELECT $2::UUID AS member_id
)

SELECT
    m.id, m.first_name, m.last_name, m.email, m.inserted_at, m.updated_at,
    m.id IN (
        SELECT member_id
        FROM pool_membership pm
        WHERE pm.pool_id = $1
    )::BOOLEAN AS is_pool_member
FROM friends f
JOIN member m ON f.member_id = m.id`;

export interface ListFriendPoolMembershipStatusArgs {
    poolId: string;
    memberid: string;
}

export interface ListFriendPoolMembershipStatusRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    insertedAt: Date;
    updatedAt: Date;
    isPoolMember: boolean;
}

export async function listFriendPoolMembershipStatus(client: Client, args: ListFriendPoolMembershipStatusArgs): Promise<ListFriendPoolMembershipStatusRow[]> {
    const result = await client.query({
        text: listFriendPoolMembershipStatusQuery,
        values: [args.poolId, args.memberid],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            firstName: row[1],
            lastName: row[2],
            email: row[3],
            insertedAt: row[4],
            updatedAt: row[5],
            isPoolMember: row[6]
        };
    });
}

export const addFriendToPoolQuery = `-- name: AddFriendToPool :one
INSERT INTO pool_membership (pool_id, member_id)
VALUES ($1, $2)
RETURNING id, pool_id, member_id, role, inserted_at, updated_at`;

export interface AddFriendToPoolArgs {
    poolId: string;
    memberId: string;
}

export interface AddFriendToPoolRow {
    id: string;
    poolId: string;
    memberId: string;
    role: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function addFriendToPool(client: Client, args: AddFriendToPoolArgs): Promise<AddFriendToPoolRow | null> {
    const result = await client.query({
        text: addFriendToPoolQuery,
        values: [args.poolId, args.memberId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        poolId: row[1],
        memberId: row[2],
        role: row[3],
        insertedAt: row[4],
        updatedAt: row[5]
    };
}

export const removeFriendFromPoolQuery = `-- name: RemoveFriendFromPool :exec
DELETE FROM pool_membership
WHERE
    pool_id = $1
    AND member_id = $2`;

export interface RemoveFriendFromPoolArgs {
    poolId: string;
    memberId: string;
}

export async function removeFriendFromPool(client: Client, args: RemoveFriendFromPoolArgs): Promise<void> {
    await client.query({
        text: removeFriendFromPoolQuery,
        values: [args.poolId, args.memberId],
        rowMode: "array"
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

export const createPoolQuery = `-- name: CreatePool :one
INSERT INTO pool (name, description)
VALUES ($1, $2)
RETURNING id, name, description, inserted_at, updated_at`;

export interface CreatePoolArgs {
    name: string;
    description: string | null;
}

export interface CreatePoolRow {
    id: string;
    name: string;
    description: string | null;
    insertedAt: Date;
    updatedAt: Date;
}

export async function createPool(client: Client, args: CreatePoolArgs): Promise<CreatePoolRow | null> {
    const result = await client.query({
        text: createPoolQuery,
        values: [args.name, args.description],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        name: row[1],
        description: row[2],
        insertedAt: row[3],
        updatedAt: row[4]
    };
}

export const createPoolMembershipQuery = `-- name: CreatePoolMembership :one
INSERT INTO pool_membership (pool_id, member_id)
VALUES ($1, $2)
RETURNING id, pool_id, member_id, role, inserted_at, updated_at`;

export interface CreatePoolMembershipArgs {
    poolId: string;
    memberId: string;
}

export interface CreatePoolMembershipRow {
    id: string;
    poolId: string;
    memberId: string;
    role: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function createPoolMembership(client: Client, args: CreatePoolMembershipArgs): Promise<CreatePoolMembershipRow | null> {
    const result = await client.query({
        text: createPoolMembershipQuery,
        values: [args.poolId, args.memberId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        poolId: row[1],
        memberId: row[2],
        role: row[3],
        insertedAt: row[4],
        updatedAt: row[5]
    };
}

export const createExpenseQuery = `-- name: CreateExpense :one
INSERT INTO expense (pool_id, paid_by_member_id, name, amount)
VALUES ($1, $2, $3, $4::DOUBLE PRECISION)
RETURNING id, pool_id, paid_by_member_id, name, description, notes, category, amount, is_settled, inserted_at, updated_at`;

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
    description: string | null;
    notes: string | null;
    category: string;
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
        description: row[4],
        notes: row[5],
        category: row[6],
        amount: row[7],
        isSettled: row[8],
        insertedAt: row[9],
        updatedAt: row[10]
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

export const createFriendRequestQuery = `-- name: CreateFriendRequest :exec
WITH potential_friend AS (
    SELECT id
    FROM member
    WHERE
        email = $2::TEXT
        AND id != $1::UUID
)

INSERT INTO friendship (inviting_member_id, friend_member_id, status)
SELECT
    $1::UUID AS inviting_member_id,
    f.id AS friend_member_id,
    'pending' AS status
FROM potential_friend f
ON CONFLICT (inviting_member_id, friend_member_id) DO NOTHING`;

export interface CreateFriendRequestArgs {
    memberid: string;
    friendemail: string;
}

export async function createFriendRequest(client: Client, args: CreateFriendRequestArgs): Promise<void> {
    await client.query({
        text: createFriendRequestQuery,
        values: [args.memberid, args.friendemail],
        rowMode: "array"
    });
}

export const acceptFriendRequestQuery = `-- name: AcceptFriendRequest :exec
WITH request AS (
    SELECT inviting_member_id, friend_member_id, status, inserted_at, updated_at
    FROM friendship
    WHERE
        friend_member_id = $1::UUID
        AND inviting_member_id = $2::UUID
        AND status = 'pending'
)

UPDATE friendship
SET status = 'accepted'
WHERE
    friend_member_id = $1::UUID
    AND inviting_member_id = $2::UUID
    AND status = 'pending'
RETURNING inviting_member_id, friend_member_id, status, inserted_at, updated_at`;

export interface AcceptFriendRequestArgs {
    memberid: string;
    friendmemberid: string;
}

export interface AcceptFriendRequestRow {
    invitingMemberId: string;
    friendMemberId: string;
    status: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function acceptFriendRequest(client: Client, args: AcceptFriendRequestArgs): Promise<void> {
    await client.query({
        text: acceptFriendRequestQuery,
        values: [args.memberid, args.friendmemberid],
        rowMode: "array"
    });
}

export const listFriendsQuery = `-- name: ListFriends :many
WITH friends AS (
    SELECT
        CASE
            WHEN f.inviting_member_id = $1 THEN f.friend_member_id
            WHEN f.friend_member_id = $1 THEN f.inviting_member_id
        END AS friend_member_id,
        f.status
    FROM friendship f
    WHERE
        (f.inviting_member_id = $1 OR f.friend_member_id = $1)
        AND f.status = 'accepted'
)

SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.email,
    f.status
FROM member m
JOIN friends f ON m.id = f.friend_member_id`;

export interface ListFriendsArgs {
    invitingMemberId: string;
}

export interface ListFriendsRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
}

export async function listFriends(client: Client, args: ListFriendsArgs): Promise<ListFriendsRow[]> {
    const result = await client.query({
        text: listFriendsQuery,
        values: [args.invitingMemberId],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            firstName: row[1],
            lastName: row[2],
            email: row[3],
            status: row[4]
        };
    });
}

export const listInboundFriendRequestsQuery = `-- name: ListInboundFriendRequests :many
WITH requests AS (
    SELECT f.inviting_member_id
    FROM friendship f
    WHERE
        f.friend_member_id = $1
        AND f.status = 'pending'
)

SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.email
FROM member m
WHERE m.id IN (
    SELECT inviting_member_id
    FROM requests
)`;

export interface ListInboundFriendRequestsArgs {
    friendMemberId: string;
}

export interface ListInboundFriendRequestsRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export async function listInboundFriendRequests(client: Client, args: ListInboundFriendRequestsArgs): Promise<ListInboundFriendRequestsRow[]> {
    const result = await client.query({
        text: listInboundFriendRequestsQuery,
        values: [args.friendMemberId],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            firstName: row[1],
            lastName: row[2],
            email: row[3]
        };
    });
}

