-- migrate:up
CREATE TYPE expense_category AS ENUM (
    'food_dining',
    'groceries',
    'transportation',
    'housing_rent',
    'utilities',
    'healthcare',
    'entertainment',
    'shopping',
    'education',
    'travel',
    'personal_care',
    'fitness',
    'subscriptions',
    'bills_payments',
    'business_expenses',
    'investments',
    'insurance',
    'gifts',
    'charity',
    'miscellaneous'
);

ALTER TABLE expense
    ADD COLUMN description TEXT,
    ADD COLUMN notes TEXT,
    ADD COLUMN category expense_category NOT NULL DEFAULT 'miscellaneous';


-- migrate:down
DROP TYPE expense_category;
ALTER TABLE expense
    DROP COLUMN description,
    DROP COLUMN notes,
    DROP COLUMN category;