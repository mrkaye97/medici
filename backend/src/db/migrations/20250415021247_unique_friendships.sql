-- migrate:up
CREATE UNIQUE INDEX ix_friendship_no_symmetric_pairs ON friendship (
  LEAST(inviting_member_id, friend_member_id),
  GREATEST(inviting_member_id, friend_member_id)
);

-- migrate:down
DROP INDEX ix_friendship_no_symmetric_pairs;