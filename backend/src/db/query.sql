-- name: ListMembers :many
SELECT *
FROM member;

-- name: ListPoolDetailsForMember :many
WITH debts_owed AS (
    SELECT
        eli.debtor_member_id,
        e.pool_id,
        SUM(eli.amount)::DOUBLE PRECISION AS total_debt,
        ARRAY_AGG(eli.amount)::DOUBLE PRECISION[] AS recent_expenses
    FROM expense_line_item eli
    JOIN expense e ON (e.id, eli.is_settled) = (eli.expense_id, false)
    WHERE
        eli.debtor_member_id = sqlc.arg(memberId)::UUID
    GROUP BY eli.debtor_member_id, e.pool_id
)

SELECT
    sqlc.arg(memberId)::UUID AS member_id,
    p.id,
    p.name,
    p.description,
    COALESCE(d.total_debt, 0.0)::DOUBLE PRECISION AS total_debt,
    COALESCE(d.recent_expenses, '{}')::DOUBLE PRECISION[] AS recent_expenses,
    p.inserted_at,
    p.updated_at
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = sqlc.arg(memberId)::UUID
LEFT JOIN debts_owed d ON d.pool_id = p.id
;

-- name: ListMembersOfPool :many
SELECT m.*
FROM member m
JOIN pool_membership pm ON m.id = pm.member_id
WHERE pm.pool_id = $1;

-- name: LoginMember :one
SELECT
    id,
    email,
    password_hash = $2 AS is_authenticated
FROM member
WHERE email = $1;

-- name: CheckAuth :one
SELECT
    id,
    password_hash = $1 AS is_authenticated
FROM member
WHERE id = $2;

-- name: CreateMember :one
INSERT INTO member (first_name, last_name, email, password_hash)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateExpense :one
INSERT INTO expense (pool_id, paid_by_member_id, name, amount)
VALUES ($1, $2, $3, sqlc.arg(amount)::DOUBLE PRECISION)
RETURNING *;

-- name: CreateExpenseLineItems :many
WITH input AS (
    SELECT
        UNNEST(sqlc.arg(expenseIds)::UUID[]) AS expense_ids,
        UNNEST(sqlc.arg(debtorMemberIds)::UUID[]) AS debtor_member_ids,
        UNNEST(sqlc.arg(amounts)::DOUBLE PRECISION[]) AS amounts
)

INSERT INTO expense_line_item (expense_id, debtor_member_id, amount)
SELECT
    i.expense_ids,
    i.debtor_member_ids,
    i.amounts
FROM input i
RETURNING *;