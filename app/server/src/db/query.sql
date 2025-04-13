-- name: ListMembers :many
SELECT *
FROM member;

-- name: ListPoolsForMember :many
WITH debts_owed AS (
    SELECT
        eli.debtor_member_id,
        e.pool_id,
        SUM(eli.amount)::DOUBLE PRECISION AS total_debt,
        ARRAY_AGG(eli.amount)::DOUBLE PRECISION[] AS recent_expenses
    FROM expense_line_item eli
    JOIN expense e ON (e.id, eli.is_settled) = (eli.expense_id, false)
    WHERE
        eli.debtor_member_id = $1
    GROUP BY eli.debtor_member_id, e.pool_id
)

SELECT
    p.*,
    COALESCE(d.total_debt, 0.0)::DOUBLE PRECISION AS total_debt,
    COALESCE(d.recent_expenses, '{}')::DOUBLE PRECISION[] AS recent_expenses
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = $1
LEFT JOIN debts_owed d ON d.pool_id = p.id
;

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