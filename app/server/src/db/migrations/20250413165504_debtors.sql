-- Modify "pool" table
ALTER TABLE "public"."pool" ALTER COLUMN "name" SET NOT NULL;

-- Modify "expense" table
ALTER TABLE "public"."expense" ADD COLUMN "pool_id" uuid NOT NULL, ADD COLUMN "paid_by_member_id" uuid NOT NULL, ADD CONSTRAINT "expense_paid_by_member_id_fkey" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."member" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "expense_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pool" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- Modify "expense_line_item" table
ALTER TABLE "public"."expense_line_item" ADD COLUMN "debtor_member_id" uuid NOT NULL, ADD CONSTRAINT "expense_line_item_debtor_member_id_fkey" FOREIGN KEY ("debtor_member_id") REFERENCES "public"."member" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
