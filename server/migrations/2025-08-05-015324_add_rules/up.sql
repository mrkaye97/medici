-- Your SQL goes here
CREATE TABLE expense_category_rule (
    member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    rule TEXT NOT NULL,
    category expense_category NOT NULL,

    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (member_id, rule, category)
);
