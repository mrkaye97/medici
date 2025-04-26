--! get_member
SELECT m.*, p.password_hash
FROM member m
JOIN member_password p ON m.id = p.member_id
WHERE m.id = :member_id;


--! list_members
SELECT *
FROM member;

--! list_pools_for_member
SELECT p.*
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id
WHERE pm.member_id = :member_id;

--! get_pool_details
WITH debts_owed AS (
    SELECT
        eli.debtor_member_id,
        e.pool_id,
        SUM(
            CASE
                WHEN e.paid_by_member_id = :member_id THEN (eli.amount - e.amount)
                ELSE eli.amount
            END
        ) AS total_debt
    FROM expense_line_item eli
    JOIN expense e ON (e.id, eli.is_settled) = (eli.expense_id, false)
    WHERE
        eli.debtor_member_id = :member_id
    GROUP BY eli.debtor_member_id, e.pool_id
)
SELECT
    :member_id AS member_id,
    p.id,
    p.name,
    p.description,
    COALESCE(d.total_debt, 0.0) AS total_debt,
    p.inserted_at,
    p.updated_at
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = :member_id
LEFT JOIN debts_owed d ON d.pool_id = p.id
WHERE p.id = :pool_id;



--! list_friend_pool_membership_status
WITH friends AS (
    SELECT
        CASE
            WHEN f.inviting_member_id = :member_id THEN f.friend_member_id
            WHEN f.friend_member_id = :member_id THEN f.inviting_member_id
        END AS member_id
    FROM friendship f
    WHERE
        (f.inviting_member_id = :member_id OR f.friend_member_id = :member_id)
        AND f.status = 'accepted'
    UNION
    SELECT :member_id AS member_id
)
SELECT
    m.*,
    m.id IN (
        SELECT member_id
        FROM pool_membership pm
        WHERE pm.pool_id = :pool_id
    )::BOOLEAN AS is_pool_member
FROM friends f
JOIN member m ON f.member_id = m.id;


--! add_friend_to_pool
INSERT INTO pool_membership (pool_id, member_id)
VALUES (:pool_id, :member_id)
RETURNING *;


--! remove_friend_from_pool
DELETE FROM pool_membership
WHERE
    pool_id = :pool_id
    AND member_id = :member_id;


--! list_pool_recent_expenses
SELECT
    e.id,
    e.name,
    e.amount AS amount,
    e.is_settled,
    e.inserted_at,
    e.updated_at,
    e.pool_id,
    e.paid_by_member_id,
    e.description,
    e.category::expense_category AS category,
    CASE
        WHEN e.paid_by_member_id = :member_id THEN (eli.amount - e.amount)
        ELSE eli.amount
    END AS amount_owed
FROM expense e
JOIN expense_line_item eli ON (e.id, e.is_settled) = (eli.expense_id, false) AND eli.debtor_member_id = :member_id
WHERE
    e.pool_id = :pool_id
    AND e.is_settled = FALSE
ORDER BY e.inserted_at DESC
LIMIT :expense_limit;


--! get_expense
SELECT
    e.id,
    e.name,
    e.amount AS amount,
    e.is_settled,
    e.inserted_at,
    e.updated_at,
    e.pool_id,
    e.paid_by_member_id
FROM expense e
WHERE id = :expense_id;


--! login_member
SELECT
    m.id,
    m.email,
    p.password_hash = :password_hash AS is_authenticated
FROM member m
JOIN member_password p ON m.id = p.member_id
WHERE m.email = :email;


--! check_auth
SELECT
    id,
    password_hash = :password_hash AS is_authenticated
FROM member_password
WHERE member_id = :member_id;


--! create_member
WITH m AS (
    INSERT INTO member (first_name, last_name, email)
    VALUES (:first_name, :last_name, :email)
    RETURNING id
)
INSERT INTO member_password (member_id, password_hash)
VALUES (
    (SELECT id FROM m),
    :password_hash::TEXT
)
RETURNING member_id;

--! create_pool
INSERT INTO pool (name, description)
VALUES (:name, :description)
RETURNING *;

--! create_pool_membership
INSERT INTO pool_membership (pool_id, member_id)
VALUES (:pool_id, :member_id)
RETURNING *;

--! create_expense
INSERT INTO expense (pool_id, paid_by_member_id, name, amount, description, category)
VALUES (:pool_id, :paid_by_member_id, :name, :amount, :description, :category::expense_category)
RETURNING *;

--! create_expense_line_items
WITH input AS (
    SELECT
        UNNEST(:expense_ids::UUID[]) AS expense_ids,
        UNNEST(:debtor_member_ids::UUID[]) AS debtor_member_ids,
        UNNEST(:amounts::DOUBLE PRECISION[]) AS amounts
)
INSERT INTO expense_line_item (expense_id, debtor_member_id, amount)
SELECT
    i.expense_ids,
    i.debtor_member_ids,
    i.amounts
FROM input i
RETURNING *;


--! create_friend_request
WITH potential_friend AS (
    SELECT id
    FROM member
    WHERE
        email = :friend_email::TEXT
        AND id != :member_id::UUID
)
INSERT INTO friendship (inviting_member_id, friend_member_id, status)
SELECT
    :member_id::UUID AS inviting_member_id,
    f.id AS friend_member_id,
    'pending' AS status
FROM potential_friend f
ON CONFLICT (inviting_member_id, friend_member_id) DO NOTHING;


--! accept_friend_request
WITH request AS (
    SELECT *
    FROM friendship
    WHERE
        friend_member_id = :member_id::UUID
        AND inviting_member_id = :friend_member_id::UUID
        AND status = 'pending'
)
UPDATE friendship
SET status = 'accepted'
WHERE
    friend_member_id = :member_id::UUID
    AND inviting_member_id = :friend_member_id::UUID
    AND status = 'pending'
RETURNING *;


--! list_friends
WITH friends AS (
    SELECT
        CASE
            WHEN f.inviting_member_id = :member_id THEN f.friend_member_id
            WHEN f.friend_member_id = :member_id THEN f.inviting_member_id
        END AS friend_member_id,
        f.status
    FROM friendship f
    WHERE
        (f.inviting_member_id = :member_id OR f.friend_member_id = :member_id)
        AND f.status = 'accepted'
)
SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.email,
    f.status
FROM member m
JOIN friends f ON m.id = f.friend_member_id;


--! list_inbound_friend_requests
WITH requests AS (
    SELECT f.inviting_member_id
    FROM friendship f
    WHERE
        f.friend_member_id = :member_id
        AND f.status = 'pending'
)
SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.email
FROM member m
WHERE m.id IN (SELECT * FROM requests);
