-- Emails are now matched case-insensitively and stored lowercase. Lowercase
-- existing rows, skipping any that would collide with another account's
-- email; those still match because lookups compare lower(email).
UPDATE member m
SET email = lower(trim(m.email))
WHERE m.email <> lower(trim(m.email))
  AND NOT EXISTS (
    SELECT 1 FROM member o
    WHERE o.id <> m.id AND lower(trim(o.email)) = lower(trim(m.email))
  );

-- Lookups filter on lower(email). Not UNIQUE, so this can't fail on old
-- mixed-case duplicates; new duplicates are rejected by the server.
CREATE INDEX IF NOT EXISTS ix_member_lower_email ON member (lower(email));
