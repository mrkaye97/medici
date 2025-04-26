-- Your SQL goes here

CREATE TYPE "public"."pool_role" AS ENUM ('PARTICIPANT', 'ADMIN');

CREATE TABLE "public"."pool" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(255) NULL, "description" text NULL, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"));

CREATE INDEX "ix_pool_name" ON "public"."pool" ("name");

CREATE TABLE "public"."member" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" text NOT NULL, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "member_email_key" UNIQUE ("email"));

CREATE UNIQUE INDEX "index_member_on_email" ON "public"."member" ("email");

CREATE TABLE "public"."pool_membership" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "pool_id" uuid NOT NULL, "member_id" uuid NOT NULL, "role" "public"."pool_role" NOT NULL DEFAULT 'PARTICIPANT', "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "pool_membership_pool_id_member_id_key" UNIQUE ("pool_id", "member_id"), CONSTRAINT "pool_membership_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."member" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "pool_membership_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pool" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);

CREATE INDEX "ix_pool_membership_member_id" ON "public"."pool_membership" ("member_id");

CREATE INDEX "ix_pool_membership_pool_id" ON "public"."pool_membership" ("pool_id");

CREATE TABLE "public"."expense" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "amount" numeric NOT NULL, "is_settled" boolean NOT NULL DEFAULT false, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id", "is_settled")) PARTITION BY LIST ("is_settled");

CREATE TABLE expense_p_is_settled_true
PARTITION OF expense
FOR VALUES IN (TRUE);

CREATE TABLE expense_p_is_settled_false
PARTITION OF expense
FOR VALUES IN (FALSE);

CREATE TABLE "public"."expense_line_item" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "expense_id" uuid NOT NULL, "is_settled" boolean NOT NULL DEFAULT false, "amount" numeric NOT NULL, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "expense_line_item_expense_id_is_settled_fkey" FOREIGN KEY ("expense_id", "is_settled") REFERENCES "public"."expense" ("id", "is_settled"));


ALTER TABLE "public"."pool" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "public"."expense" ADD COLUMN "pool_id" uuid NOT NULL, ADD COLUMN "paid_by_member_id" uuid NOT NULL, ADD CONSTRAINT "expense_paid_by_member_id_fkey" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."member" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "expense_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pool" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "public"."expense_line_item" ADD COLUMN "debtor_member_id" uuid NOT NULL, ADD CONSTRAINT "expense_line_item_debtor_member_id_fkey" FOREIGN KEY ("debtor_member_id") REFERENCES "public"."member" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

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

ALTER TABLE expense
    ADD COLUMN description TEXT,
    ADD COLUMN notes TEXT,
    ADD COLUMN category expense_category NOT NULL DEFAULT 'miscellaneous';

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

ALTER TABLE member
ADD COLUMN bio TEXT;

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

DO $$
DECLARE
  t_name text;
BEGIN
  FOR t_name IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
  LOOP
    -- Check if trigger doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'set_updated_at'
      AND event_object_table = t_name
    ) THEN
      PERFORM add_updated_at_trigger(t_name);
    END IF;
  END LOOP;
END
$$;