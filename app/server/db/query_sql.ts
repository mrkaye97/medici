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

