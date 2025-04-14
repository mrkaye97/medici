-- name: GetMember :one
SELECT m.*, p.password_hash
FROM member m
JOIN member_password p ON m.id = p.member_id
WHERE m.id = $1;

-- name: ListMembers :many
SELECT *
FROM member;

-- name: ListPoolsForMember :many
SELECT p.*
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id
WHERE pm.member_id = $1;

-- name: GetPoolDetails :one
WITH debts_owed AS (
    SELECT
        eli.debtor_member_id,
        e.pool_id,
        SUM(eli.amount)::DOUBLE PRECISION AS total_debt
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
    p.inserted_at,
    p.updated_at
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = sqlc.arg(memberId)::UUID
LEFT JOIN debts_owed d ON d.pool_id = p.id
WHERE p.id = sqlc.arg(poolId)::UUID
;

-- name: ListMembersOfPool :many
SELECT m.*
FROM member m
JOIN pool_membership pm ON m.id = pm.member_id
WHERE pm.pool_id = $1;

-- name: ListPoolRecentExpenses :many
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
LIMIT sqlc.arg(expenseLimit)::INTEGER
;

-- name: GetExpense :one
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
WHERE id = $1;

-- name: LoginMember :one
SELECT
    m.id,
    m.email,
    p.password_hash = $2 AS is_authenticated
FROM member m
JOIN member_password p ON m.id = p.member_id
WHERE m.email = $1;

-- name: CheckAuth :one
SELECT
    id,
    password_hash = $1 AS is_authenticated
FROM member_password
WHERE member_id = $2;

-- name: CreateMember :one
WITH m AS (
    INSERT INTO member (first_name, last_name, email)
    VALUES ($1, $2, $3)
    RETURNING id
)
INSERT INTO member_password (member_id, password_hash)
VALUES (
    (SELECT id FROM m),
    sqlc.arg(passwordHash)::TEXT
)
RETURNING member_id;

-- name: CreatePool :one
INSERT INTO pool (name, description)
VALUES ($1, $2)
RETURNING *;

-- name: CreatePoolMembership :one
INSERT INTO pool_membership (pool_id, member_id)
VALUES ($1, $2)
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

-- name: CreateFriendRequest :exec
INSERT INTO friendship (member_id, friend_member_id)
VALUES
    ($1, $2),
    ($2, $1)
ON CONFLICT (member_id, friend_member_id) DO NOTHING;

-- name: ListFriends :many
SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.email,
    f.status
FROM member m
JOIN friendship f ON m.id = f.friend_member_id
WHERE
    f.member_id = $1
;
