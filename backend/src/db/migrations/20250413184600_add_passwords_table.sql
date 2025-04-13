BEGIN;

CREATE TABLE member_password (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_member_password_on_member_id ON member_password (member_id);

INSERT INTO member_password (member_id, password_hash)
SELECT id, password_hash
FROM member
;

ALTER TABLE member DROP COLUMN password_hash;

COMMIT;