-- Create enum type "pool_role"
CREATE TYPE "public"."pool_role" AS ENUM ('PARTICIPANT', 'ADMIN');


-- Create "pool" table
CREATE TABLE "public"."pool" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(255) NULL, "description" text NULL, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"));

-- Create index "ix_pool_name" to table: "pool"
CREATE INDEX "ix_pool_name" ON "public"."pool" ("name");

-- Create "member" table
CREATE TABLE "public"."member" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" text NOT NULL, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "member_email_key" UNIQUE ("email"));

-- Create index "index_member_on_email" to table: "member"
CREATE UNIQUE INDEX "index_member_on_email" ON "public"."member" ("email");

-- Create "pool_membership" table
CREATE TABLE "public"."pool_membership" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "pool_id" uuid NOT NULL, "member_id" uuid NOT NULL, "role" "public"."pool_role" NOT NULL DEFAULT 'PARTICIPANT', "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "pool_membership_pool_id_member_id_key" UNIQUE ("pool_id", "member_id"), CONSTRAINT "pool_membership_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."member" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "pool_membership_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pool" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);
-- Create index "ix_pool_membership_member_id" to table: "pool_membership"
CREATE INDEX "ix_pool_membership_member_id" ON "public"."pool_membership" ("member_id");
-- Create index "ix_pool_membership_pool_id" to table: "pool_membership"
CREATE INDEX "ix_pool_membership_pool_id" ON "public"."pool_membership" ("pool_id");

-- Create "expense" table
CREATE TABLE "public"."expense" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "amount" numeric NOT NULL, "is_settled" boolean NOT NULL DEFAULT false, "inserted_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id", "is_settled")) PARTITION BY LIST ("is_settled");

CREATE TABLE expense_p_is_settled_true
PARTITION OF expense
FOR VALUES IN (TRUE);

CREATE TABLE expense_p_is_settled_false
PARTITION OF expense
FOR VALUES IN (FALSE);

-- Create "expense_line_item" table
CREATE TABLE "public"."expense_line_item" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "expense_id" uuid NOT NULL, "is_settled" boolean NOT NULL DEFAULT false, "amount" numeric NOT NULL, "inserted_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "expense_line_item_expense_id_is_settled_fkey" FOREIGN KEY ("expense_id", "is_settled") REFERENCES "public"."expense" ("id", "is_settled"));
