-- Chạy sau migrate + seed trên DB test riêng. Toàn bộ thao tác thử được ROLLBACK.
BEGIN;

DO $$
DECLARE
    lecturer_count INTEGER;
    representative_count INTEGER;
BEGIN
    IF to_regclass('app.academic_years') IS NULL
       OR to_regclass('app.achievement_types') IS NULL
       OR to_regclass('app.award_types') IS NULL
       OR to_regclass('app.unit_representatives') IS NULL THEN
        RAISE EXCEPTION 'W1-P2 tables are missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_achievements_subject_xor'
          AND conrelid = 'app.achievements'::regclass
    ) THEN
        RAISE EXCEPTION 'Achievement subject XOR constraint is missing';
    END IF;

    SELECT COUNT(*) INTO lecturer_count
    FROM app.lecturers lecturer
    WHERE EXISTS (
        SELECT 1 FROM app.lecturer_assignments assignment
        WHERE assignment.lecturer_id = lecturer.lecturer_id
    );

    SELECT COUNT(*) INTO representative_count
    FROM app.unit_representatives;

    IF lecturer_count < 1 OR representative_count < 1 THEN
        RAISE EXCEPTION 'Seed must contain both personal and collective profile data';
    END IF;

    IF (SELECT COUNT(*) FROM app.academic_years) < 1
       OR (SELECT COUNT(*) FROM app.achievement_types) < 1
       OR (SELECT COUNT(*) FROM app.award_types) < 1 THEN
        RAISE EXCEPTION 'Catalog seed is incomplete';
    END IF;

    BEGIN
        INSERT INTO app.lecturer_assignments (
            lecturer_id, unit_id, is_primary, valid_from, valid_to, assigned_by
        ) VALUES (
            1, 3, TRUE, TIMESTAMPTZ '2021-01-01 00:00:00+00', NULL, 3
        );
        RAISE EXCEPTION 'Expected overlapping primary assignment to be rejected';
    EXCEPTION
        WHEN exclusion_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO app.unit_representatives (
            user_id, unit_id, valid_from, valid_to, assigned_by
        ) VALUES (
            2, 2, TIMESTAMPTZ '2025-06-01 00:00:00+00', NULL, 3
        );
        RAISE EXCEPTION 'Expected overlapping unit representative to be rejected';
    EXCEPTION
        WHEN exclusion_violation THEN NULL;
    END;
END $$;

ROLLBACK;

