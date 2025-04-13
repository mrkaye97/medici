-- name: ListMembers :many
SELECT *
FROM member;

-- name: ListPoolsForMember :many
SELECT *
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = $1;

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