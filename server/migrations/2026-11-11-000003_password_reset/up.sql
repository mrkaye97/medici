-- One-time password reset links. Only a SHA-256 hash of the token is stored,
-- so a database leak doesn't hand out working reset links.
CREATE TABLE password_reset_token (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ix_password_reset_token_hash ON password_reset_token (token_hash);
CREATE INDEX ix_password_reset_token_member_id ON password_reset_token (member_id);

-- Sessions issued before this time are rejected, so resetting a password
-- logs out every existing session. Existing rows get the epoch so nobody is
-- logged out by this migration.
ALTER TABLE member_password
  ADD COLUMN password_changed_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch';
ALTER TABLE member_password
  ALTER COLUMN password_changed_at SET DEFAULT NOW();
