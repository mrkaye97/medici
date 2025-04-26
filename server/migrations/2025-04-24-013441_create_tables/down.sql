-- This file should undo anything in `up.sql`
DO $$
DECLARE
  t_name text;
BEGIN
  FOR t_name IN
    SELECT event_object_table
    FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at'
    AND trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t_name);
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS add_updated_at_trigger;
DROP FUNCTION IF EXISTS trigger_set_updated_at;

ALTER TABLE member
DROP COLUMN bio;

DROP INDEX IF EXISTS ix_friendship_no_symmetric_pairs;

DROP TABLE IF EXISTS friendship;
DROP TYPE IF EXISTS friendship_status;

ALTER TABLE expense
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS category;
DROP TYPE IF EXISTS expense_category;

DROP INDEX IF EXISTS index_member_password_on_member_id;
DROP TABLE IF EXISTS member_password;
ALTER TABLE member ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';

ALTER TABLE "public"."expense_line_item" DROP CONSTRAINT IF EXISTS "expense_line_item_debtor_member_id_fkey", DROP COLUMN IF EXISTS "debtor_member_id";
ALTER TABLE "public"."expense" DROP CONSTRAINT IF EXISTS "expense_pool_id_fkey", DROP CONSTRAINT IF EXISTS "expense_paid_by_member_id_fkey", DROP COLUMN IF EXISTS "pool_id", DROP COLUMN IF EXISTS "paid_by_member_id";
ALTER TABLE "public"."pool" ALTER COLUMN "name" DROP NOT NULL;

DROP TABLE IF EXISTS "public"."expense_line_item";
DROP TABLE IF EXISTS "public"."expense_p_is_settled_false";
DROP TABLE IF EXISTS "public"."expense_p_is_settled_true";
DROP TABLE IF EXISTS "public"."expense";
DROP INDEX IF EXISTS "ix_pool_membership_pool_id";
DROP INDEX IF EXISTS "ix_pool_membership_member_id";
DROP TABLE IF EXISTS "public"."pool_membership";
DROP INDEX IF EXISTS "index_member_on_email";
DROP TABLE IF EXISTS "public"."member";
DROP TABLE IF EXISTS "public"."pool";
DROP TYPE IF EXISTS "public"."pool_role";