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
        SUM(
            CASE
                WHEN e.paid_by_member_id = sqlc.arg(memberId)::UUID THEN (eli.amount - e.amount)
                ELSE eli.amount
            END
        )::DOUBLE PRECISION AS total_debt
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

-- name: ListFriendPoolMembershipStatus :many
WITH friends AS (
    SELECT
        CASE
            WHEN f.inviting_member_id = sqlc.arg(memberId)::UUID THEN f.friend_member_id
            WHEN f.friend_member_id = sqlc.arg(memberId)::UUID THEN f.inviting_member_id
        END AS member_id
    FROM friendship f
    WHERE
        (f.inviting_member_id = sqlc.arg(memberId)::UUID OR f.friend_member_id = sqlc.arg(memberId)::UUID)
        AND f.status = 'accepted'

    UNION

    SELECT sqlc.arg(memberId)::UUID AS member_id
)

SELECT
    m.*,
    m.id IN (
        SELECT member_id
        FROM pool_membership pm
        WHERE pm.pool_id = $1
    )::BOOLEAN AS is_pool_member
FROM friends f
JOIN member m ON f.member_id = m.id;

-- name: AddFriendToPool :one
INSERT INTO pool_membership (pool_id, member_id)
VALUES ($1, $2)
RETURNING *;

-- name: RemoveFriendFromPool :exec
DELETE FROM pool_membership
WHERE
    pool_id = $1
    AND member_id = $2
;

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
    e.description,
    e.category::expense_category AS category,
    CASE
        WHEN e.paid_by_member_id = sqlc.arg(memberId)::UUID THEN (eli.amount - e.amount)::DOUBLE PRECISION
        ELSE eli.amount::DOUBLE PRECISION
    END AS amount_owed
FROM expense e
JOIN expense_line_item eli ON (e.id, e.is_settled) = (eli.expense_id, false) AND eli.debtor_member_id = sqlc.arg(memberId)::UUID
WHERE
    e.pool_id = sqlc.arg(poolId)::UUID
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
INSERT INTO expense (pool_id, paid_by_member_id, name, amount, description, category)
VALUES ($1, $2, $3, sqlc.arg(amount)::DOUBLE PRECISION, sqlc.narg(description), sqlc.arg(category)::expense_category)
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
WITH potential_friend AS (
    SELECT id
    FROM member
    WHERE
        email = sqlc.arg(friendEmail)::TEXT
        AND id != sqlc.arg(memberId)::UUID
)

INSERT INTO friendship (inviting_member_id, friend_member_id, status)
SELECT
    sqlc.arg(memberId)::UUID AS inviting_member_id,
    f.id AS friend_member_id,
    'pending' AS status
FROM potential_friend f
ON CONFLICT (inviting_member_id, friend_member_id) DO NOTHING;

-- name: AcceptFriendRequest :exec
WITH request AS (
    SELECT *
    FROM friendship
    WHERE
        friend_member_id = sqlc.arg(memberId)::UUID
        AND inviting_member_id = sqlc.arg(friendMemberId)::UUID
        AND status = 'pending'
)

UPDATE friendship
SET status = 'accepted'
WHERE
    friend_member_id = sqlc.arg(memberId)::UUID
    AND inviting_member_id = sqlc.arg(friendMemberId)::UUID
    AND status = 'pending'
RETURNING *
;

-- name: ListFriends :many
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
JOIN friends f ON m.id = f.friend_member_id
;

-- name: ListInboundFriendRequests :many
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
)
;
