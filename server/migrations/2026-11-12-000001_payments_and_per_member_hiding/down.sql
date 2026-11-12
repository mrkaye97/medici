ALTER TABLE pool ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- A pool counts as hidden if any member had hidden it.
UPDATE pool p
SET is_hidden = TRUE
WHERE EXISTS (
  SELECT 1 FROM pool_membership pm WHERE pm.pool_id = p.id AND pm.is_hidden
);

ALTER TABLE pool_membership DROP COLUMN is_hidden;
ALTER TABLE expense DROP COLUMN is_payment;
