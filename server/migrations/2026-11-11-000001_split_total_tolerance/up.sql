-- Default splits are floats, so requiring an exact total of 100 made valid
-- splits like 33.33 / 33.33 / 33.34 fail on float rounding. The server
-- rounds splits to exactly 100.00 (see SPLIT_TOTAL_TOLERANCE_HUNDREDTHS in
-- lib.rs); this only needs to allow float noise around that.
CREATE OR REPLACE FUNCTION validate_split_percentages_sum_to_100()
RETURNS TRIGGER AS $$
DECLARE
    default_split_sum DOUBLE PRECISION;
    default_split_count INTEGER;
    pool_id_to_check UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        pool_id_to_check := OLD.pool_id;
    ELSE
        pool_id_to_check := NEW.pool_id;
    END IF;

    SELECT COALESCE(SUM(default_split_percentage), 0), COUNT(*)
    INTO default_split_sum, default_split_count
    FROM pool_membership
    WHERE pool_id = pool_id_to_check;

    IF default_split_count > 0 THEN
        IF ABS(default_split_sum - 100.0) > 0.015 THEN
            RAISE EXCEPTION 'Default split percentage sum (%) does not equal 100 for pool_id %',
                default_split_sum, pool_id_to_check;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
