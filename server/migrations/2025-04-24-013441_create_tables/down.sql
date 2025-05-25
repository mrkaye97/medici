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

DROP TABLE expense_line_item;
DROP TABLE expense_p_is_settled_false;
DROP TABLE expense_p_is_settled_true;
DROP TABLE expense;
DROP TABLE pool_membership;
DROP TABLE friendship;
DROP TABLE member_password;
DROP TABLE pool;
DROP TABLE member;

DROP TYPE pool_role;
DROP TYPE expense_category;
DROP TYPE friendship_status;


DROP FUNCTION add_updated_at_trigger;
DROP FUNCTION trigger_set_updated_at;
DROP FUNCTION validate_expense_after_insert;
DROP FUNCTION validate_split_percentages_sum_to_100;
