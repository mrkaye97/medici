-- migrate:up
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

-- migrate:down
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
    EXECUTE format('DROP TRIGGER set_updated_at ON %I', t_name);
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS add_updated_at_trigger;
DROP FUNCTION IF EXISTS trigger_set_updated_at;
