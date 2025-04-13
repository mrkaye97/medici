-- Modify "expense_line_item" table
ALTER TABLE "public"."expense_line_item"
    DROP CONSTRAINT "expense_line_item_expense_id_is_settled_fkey",
    DROP CONSTRAINT "expense_line_item_expense_id_is_settled_fkey1",
    DROP CONSTRAINT "expense_line_item_expense_id_is_settled_fkey2",
    ADD CONSTRAINT "expense_line_item_expense_id_is_settled_fkey" FOREIGN KEY ("expense_id", "is_settled") REFERENCES "public"."expense" ("id", "is_settled") ON UPDATE NO ACTION ON DELETE CASCADE,
    ADD CONSTRAINT "expense_line_item_expense_id_is_settled_fkey1" FOREIGN KEY ("expense_id", "is_settled") REFERENCES "public"."expense_p_is_settled_false" ("id", "is_settled") ON UPDATE NO ACTION ON DELETE CASCADE,
    ADD CONSTRAINT "expense_line_item_expense_id_is_settled_fkey2" FOREIGN KEY ("expense_id", "is_settled") REFERENCES "public"."expense_p_is_settled_true" ("id", "is_settled") ON UPDATE NO ACTION ON DELETE CASCADE;
