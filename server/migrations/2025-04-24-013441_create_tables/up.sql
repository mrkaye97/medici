-- Pools
CREATE TABLE pool (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  description text NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Members
CREATE TABLE member (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name character varying(255) NOT NULL,
  last_name character varying(255) NOT NULL,
  email character varying(255) NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bio TEXT,
  PRIMARY KEY (id),
  CONSTRAINT member_email_key UNIQUE (email)
);

CREATE UNIQUE INDEX index_member_on_email ON member (email);

-- Pool Memberships
CREATE TYPE pool_role AS ENUM ('PARTICIPANT', 'ADMIN');
CREATE TABLE pool_membership (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL,
  member_id uuid NOT NULL,
  role pool_role NOT NULL DEFAULT 'PARTICIPANT',
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
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
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  is_settled boolean NOT NULL DEFAULT false,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  pool_id UUID NOT NULL,
  paid_by_member_id uuid NOT NULL,
  description TEXT,
  notes TEXT,
  category expense_category NOT NULL DEFAULT 'miscellaneous',
  PRIMARY KEY (id, is_settled),
  CONSTRAINT expense_paid_by_member_id_fkey FOREIGN KEY (paid_by_member_id) REFERENCES member (id) ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT expense_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES pool (id) ON UPDATE NO ACTION ON DELETE CASCADE
) PARTITION BY LIST (is_settled);


CREATE TABLE expense_p_is_settled_true PARTITION OF expense FOR
VALUES IN (TRUE);

CREATE TABLE expense_p_is_settled_false PARTITION OF expense FOR
VALUES IN (FALSE);

-- Expense line items
CREATE TABLE expense_line_item (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  is_settled boolean NOT NULL DEFAULT false,
  amount DOUBLE PRECISION NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  debtor_member_id UUID NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT expense_line_item_expense_id_is_settled_fkey FOREIGN KEY (expense_id, is_settled) REFERENCES expense (id, is_settled),
  CONSTRAINT expense_line_item_debtor_member_id_fkey FOREIGN KEY (debtor_member_id) REFERENCES member (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Passwords
CREATE TABLE member_password (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE
OR REPLACE FUNCTION trigger_set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE
OR REPLACE FUNCTION add_updated_at_trigger(table_name text) RETURNS void AS $$ BEGIN EXECUTE format(
  '
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON %I
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  ',
  table_name
);
END;
$$ LANGUAGE plpgsql;
DO $$ DECLARE t_name text;
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
