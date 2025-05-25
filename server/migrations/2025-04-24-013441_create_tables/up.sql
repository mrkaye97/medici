-- Pools
CREATE TABLE pool (
  id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
  name TEXT NOT NULL,
  description TEXT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);


-- Members
CREATE TABLE member (
  id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bio TEXT,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX index_member_on_email ON member (email);

-- Pool Memberships
CREATE TYPE pool_role AS ENUM ('PARTICIPANT', 'ADMIN');
CREATE TABLE pool_membership (
  id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
  pool_id UUID NOT NULL,
  member_id UUID NOT NULL,
  role pool_role NOT NULL DEFAULT 'PARTICIPANT',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  default_split_percentage DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (default_split_percentage >= 0.0 AND default_split_percentage <= 100.0),
  PRIMARY KEY (id),
  CONSTRAINT pool_membership_member_id_fkey FOREIGN KEY (member_id) REFERENCES member (id) ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT pool_membership_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pool (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_pool_membership_member_id_pool_id ON pool_membership (member_id, pool_id);


-- Expenses
CREATE TYPE expense_category AS ENUM (
  'food_dining', 'groceries', 'transportation',
  'housing_rent', 'utilities', 'healthcare',
  'entertainment', 'shopping', 'education',
  'travel', 'personal_care', 'fitness',
  'subscriptions', 'bills_payments',
  'business_expenses', 'investments',
  'insurance', 'gifts', 'charity',
  'miscellaneous'
);

CREATE TABLE expense (
  id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
  name TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0.0),
  is_settled BOOLEAN NOT NULL DEFAULT FALSE,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pool_id UUID NOT NULL,
  paid_by_member_id UUID NOT NULL,
  description TEXT,
  notes TEXT,
  category expense_category NOT NULL DEFAULT 'miscellaneous',
  PRIMARY KEY (id, is_settled),
  CONSTRAINT expense_paid_by_member_id_fkey FOREIGN KEY (paid_by_member_id) REFERENCES member (id) ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT expense_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pool (id) ON UPDATE NO ACTION ON DELETE CASCADE
) PARTITION BY LIST (is_settled);


CREATE TABLE expense_p_is_settled_true PARTITION OF expense FOR
VALUES IN (TRUE);

CREATE TABLE expense_p_is_settled_FALSE PARTITION OF expense FOR
VALUES IN (FALSE);

-- Expense line items
CREATE TABLE expense_line_item (
  id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
  expense_id UUID NOT NULL,
  is_settled BOOLEAN NOT NULL DEFAULT FALSE,
  amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0.0),
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  debtor_member_id UUID NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT expense_line_item_expense_id_is_settled_fkey FOREIGN KEY (expense_id, is_settled) REFERENCES expense (id, is_settled),
  CONSTRAINT expense_line_item_debtor_member_id_fkey FOREIGN KEY (debtor_member_id) REFERENCES member (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX ix_expense_line_item_expense_id_is_settled ON expense_line_item (expense_id, is_settled);

-- Passwords
CREATE TABLE member_password (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_member_password_on_member_id ON member_password (member_id);


-- Friendships
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');
CREATE TABLE friendship (
  inviting_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  friend_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    inviting_member_id, friend_member_id
  )
);
CREATE UNIQUE INDEX ix_friendship_no_symmetric_pairs ON friendship (
  LEAST(
    inviting_member_id, friend_member_id
  ),
  GREATEST(
    inviting_member_id, friend_member_id
  )
);

-- Triggers
-- Set updated_at on insert and update
CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_updated_at_trigger(table_name TEXT) RETURNS void AS $$ BEGIN EXECUTE format(
  '
    CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON %I
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  ',
  table_name
);
END;
$$ LANGUAGE plpgsql;
DO $$ DECLARE t_name TEXT;
BEGIN FOR t_name IN
SELECT
  table_name
FROM
  information_schema.columns
WHERE
  column_name = 'updated_at'
  AND table_schema = 'public' LOOP -- Check if trigger doesn't already exist
  IF NOT EXISTS (
    SELECT
      1
    FROM
      information_schema.triggers
    WHERE
      trigger_name = 'set_updated_at'
      AND event_object_table = t_name
  ) THEN PERFORM add_updated_at_trigger(t_name);
END IF;
END LOOP;
END $$;


-- Check that the sum of line items matches the expense amount
CREATE OR REPLACE FUNCTION validate_expense_after_insert()
RETURNS TRIGGER AS $$
DECLARE
    line_items_sum DOUBLE PRECISION;
    line_items_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO line_items_sum, line_items_count
    FROM expense_line_item
    WHERE expense_id = NEW.id
      AND is_settled = NEW.is_settled;

    IF line_items_count > 0 THEN
        IF line_items_sum <> NEW.amount THEN
            RAISE EXCEPTION 'Line items sum (%) does not match expense amount (%) for expense_id %',
                line_items_sum, NEW.amount, NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER expense_validation_after_insert_trigger
AFTER INSERT ON expense
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_expense_after_insert();

-- Validate that the sum of default_split_percentages for a pool equals 100
CREATE OR REPLACE FUNCTION validate_split_percentages_sum_to_100()
RETURNS TRIGGER AS $$
DECLARE
    default_split_sum DOUBLE PRECISION;
    default_split_count INTEGER;
    pool_id_to_check UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        pool_id_to_check := OLD.pool_id;
    ELSE
        pool_id_to_check := NEW.pool_id;
    END IF;

    SELECT COALESCE(SUM(default_split_percentage), 0), COUNT(*)
    INTO default_split_sum, default_split_count
    FROM pool_membership
    WHERE pool_id = pool_id_to_check;

    IF default_split_count > 0 THEN
        IF default_split_sum <> 100.0 THEN
            RAISE EXCEPTION 'Default split percentage sum (%) does not equal 100 for pool_id %',
                default_split_sum, pool_id_to_check;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER expense_validation_after_insert_trigger
AFTER INSERT OR UPDATE OR DELETE ON pool_membership
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_split_percentages_sum_to_100();
