CREATE TYPE split_method AS ENUM (
    'percentage',
    'amount',
    'default'
);

ALTER TABLE expense ADD COLUMN split_method split_method NOT NULL DEFAULT 'default';

WITH inferred_split_methods AS (
    SELECT
        e.id,
        e.is_settled,
        BOOL_OR(ABS(e.amount * (pm.default_split_percentage / 100.0) - eli.amount) < 0.10) AS was_split_by_default
    FROM pool p
    JOIN pool_membership pm ON p.id = pm.pool_id
    JOIN expense e ON pm.pool_id = e.pool_id
    JOIN expense_line_item eli ON (eli.expense_id, eli.debtor_member_id) = (e.id, pm.member_id)
    GROUP BY e.id, e.is_settled
)

UPDATE expense
SET split_method = CASE
    WHEN inferred_split_methods.was_split_by_default THEN 'default'::split_method
    ELSE 'percentage'::split_method
END
FROM inferred_split_methods
WHERE (expense.id, expense.is_settled) = (inferred_split_methods.id, inferred_split_methods.is_settled);