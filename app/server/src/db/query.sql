-- name: ListMembers :many
SELECT *
FROM member;

-- name: ListPoolsForMember :many
SELECT *
FROM pool p
JOIN pool_membership pm ON p.id = pm.pool_id AND pm.member_id = $1;

