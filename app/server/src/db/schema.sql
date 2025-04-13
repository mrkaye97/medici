CREATE TABLE pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    description TEXT,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_pool_name ON pool (name);

CREATE TABLE member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_member_on_email ON member (email);

CREATE TYPE pool_role AS ENUM ('PARTICIPANT', 'ADMIN');

CREATE TABLE pool_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES pool(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    role pool_role NOT NULL DEFAULT 'PARTICIPANT',
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pool_id, member_id)
);

CREATE INDEX ix_pool_membership_member_id ON pool_membership (member_id);
CREATE INDEX ix_pool_membership_pool_id ON pool_membership (pool_id);

CREATE TABLE expense (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, is_settled),
    UNIQUE (id, is_settled)
) PARTITION BY LIST(is_settled);

CREATE TABLE expense_p_is_settled_true
PARTITION OF expense
FOR VALUES IN (TRUE);

CREATE TABLE expense_p_is_settled_false
PARTITION OF expense
FOR VALUES IN (FALSE);

CREATE TABLE expense_line_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    amount NUMERIC NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (expense_id, is_settled) REFERENCES expense(id, is_settled) ON DELETE CASCADE
);
