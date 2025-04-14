-- migrate:up
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');
CREATE TABLE friendship (
    member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    friend_member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    status friendship_status NOT NULL DEFAULT 'pending',
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (member_id, friend_member_id)
);


-- migrate:down
DROP TABLE friendship;
DROP TYPE friendship_status;