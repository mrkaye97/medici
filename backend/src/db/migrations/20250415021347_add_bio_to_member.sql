-- migrate:up
ALTER TABLE member
ADD COLUMN bio TEXT;

-- migrate:down
ALTER TABLE member
DROP COLUMN bio;