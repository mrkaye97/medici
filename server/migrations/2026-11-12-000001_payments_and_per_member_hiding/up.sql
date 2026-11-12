-- Settling up now records a payment ("Erin paid Frank $10") as an expense
-- that cancels exactly the balance between those two people, instead of
-- marking every expense in the pool settled for everyone.
ALTER TABLE expense ADD COLUMN is_payment BOOLEAN NOT NULL DEFAULT FALSE;

-- Hiding a pool is per person. Whoever could see a pool as hidden before
-- keeps seeing it hidden.
ALTER TABLE pool_membership ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE pool_membership pm
SET is_hidden = p.is_hidden
FROM pool p
WHERE p.id = pm.pool_id AND p.is_hidden;

ALTER TABLE pool DROP COLUMN is_hidden;
