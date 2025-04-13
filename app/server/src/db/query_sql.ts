import { QueryArrayConfig, QueryArrayResult } from "pg";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const listMembersQuery = `-- name: ListMembers :many
SELECT id, first_name, last_name, email, password_hash, inserted_at, updated_at
FROM member`;

export interface ListMembersRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
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
            passwordHash: row[4],
            insertedAt: row[5],
            updatedAt: row[6]
        };
    });
}

export const listPoolsForMemberQuery = `-- name: ListPoolsForMember :many
SELECT p.id, name, description, p.inserted_at, p.updated_at, pm.id, pool_id, member_id, role, pm.inserted_at, pm.updated_at
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = $1`;

export interface ListPoolsForMemberArgs {
    memberId: string;
}

export interface ListPoolsForMemberRow {
    id: string;
    name: string | null;
    description: string | null;
    insertedAt: Date;
    updatedAt: Date;
    id_2: string;
    poolId: string;
    memberId: string;
    role: string;
    insertedAt_2: Date;
    updatedAt_2: Date;
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
            updatedAt: row[4],
            id_2: row[5],
            poolId: row[6],
            memberId: row[7],
            role: row[8],
            insertedAt_2: row[9],
            updatedAt_2: row[10]
        };
    });
}

export const loginMemberQuery = `-- name: LoginMember :one
SELECT
    id,
    email,
    password_hash = $2 AS is_authenticated
FROM member
WHERE email = $1`;

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
FROM member
WHERE id = $2`;

export interface CheckAuthArgs {
    passwordHash: string;
    id: string;
}

export interface CheckAuthRow {
    id: string;
    isAuthenticated: boolean;
}

export async function checkAuth(client: Client, args: CheckAuthArgs): Promise<CheckAuthRow | null> {
    const result = await client.query({
        text: checkAuthQuery,
        values: [args.passwordHash, args.id],
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
INSERT INTO member (first_name, last_name, email, password_hash)
VALUES ($1, $2, $3, $4)
RETURNING id, first_name, last_name, email, password_hash, inserted_at, updated_at`;

export interface CreateMemberArgs {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
}

export interface CreateMemberRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    insertedAt: Date;
    updatedAt: Date;
}

export async function createMember(client: Client, args: CreateMemberArgs): Promise<CreateMemberRow | null> {
    const result = await client.query({
        text: createMemberQuery,
        values: [args.firstName, args.lastName, args.email, args.passwordHash],
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
        passwordHash: row[4],
        insertedAt: row[5],
        updatedAt: row[6]
    };
}

