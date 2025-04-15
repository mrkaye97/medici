CREATE TABLE pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
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
    bio TEXT,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_member_on_email ON member (email);

CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');

CREATE TABLE friendship (
    inviting_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    friend_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    status friendship_status NOT NULL DEFAULT 'pending',
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (inviting_member_id, friend_member_id)
);

CREATE UNIQUE INDEX ix_friendship_no_symmetric_pairs ON friendship (
  LEAST(inviting_member_id, friend_member_id),
  GREATEST(inviting_member_id, friend_member_id)
);

CREATE TABLE member_password (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_member_password_on_member_id ON member_password (member_id);

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

CREATE TYPE expense_category AS ENUM (
    'food_dining',
    'groceries',
    'transportation',
    'housing_rent',
    'utilities',
    'healthcare',
    'entertainment',
    'shopping',
    'education',
    'travel',
    'personal_care',
    'fitness',
    'subscriptions',
    'bills_payments',
    'business_expenses',
    'investments',
    'insurance',
    'gifts',
    'charity',
    'miscellaneous'
);

CREATE TABLE expense (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES pool(id) ON DELETE CASCADE,
    paid_by_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    category expense_category NOT NULL DEFAULT 'miscellaneous',
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
    debtor_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    amount NUMERIC NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (expense_id, is_settled) REFERENCES expense(id, is_settled) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_updated_at_trigger(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON %I
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  ', table_name);
END;
$$ LANGUAGE plpgsql;

-- Add this to a migration to create the trigger for a new table
-- SELECT add_updated_at_trigger('your_new_table_name');
