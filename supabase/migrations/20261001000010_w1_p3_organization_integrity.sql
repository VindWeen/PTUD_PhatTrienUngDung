-- ==============================================================================
-- W1-P3: Bảo toàn lịch sử tổ chức, chặn chu trình và chuẩn hóa trạng thái profile.
-- ==============================================================================

-- Đồng bộ trạng thái schema nền với hợp đồng W1-Q1 trước khi thay constraint.
UPDATE app.achievements SET status = 'NEED_CORRECTION' WHERE status = 'RETURNED';
ALTER TABLE app.achievements DROP CONSTRAINT IF EXISTS ck_achievements_status;
ALTER TABLE app.achievements
    ADD CONSTRAINT ck_achievements_status CHECK (
        status IN ('DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED')
    );

UPDATE app.award_records SET status = 'REVOKED' WHERE status = 'CANCELLED';
ALTER TABLE app.award_records DROP CONSTRAINT IF EXISTS ck_award_records_status;
ALTER TABLE app.award_records
    ADD CONSTRAINT ck_award_records_status CHECK (status IN ('RECORDED', 'REVOKED'));

-- Dữ liệu lịch sử không được mất theo đơn vị: thay CASCADE bằng RESTRICT.
ALTER TABLE app.lecturer_assignments DROP CONSTRAINT IF EXISTS lecturer_assignments_unit_id_fkey;
ALTER TABLE app.lecturer_assignments
    ADD CONSTRAINT lecturer_assignments_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES app.organization_units(unit_id) ON DELETE RESTRICT;

ALTER TABLE app.user_unit_scopes DROP CONSTRAINT IF EXISTS user_unit_scopes_unit_id_fkey;
ALTER TABLE app.user_unit_scopes
    ADD CONSTRAINT user_unit_scopes_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES app.organization_units(unit_id) ON DELETE RESTRICT;

ALTER TABLE app.unit_representatives DROP CONSTRAINT IF EXISTS unit_representatives_unit_id_fkey;
ALTER TABLE app.unit_representatives
    ADD CONSTRAINT unit_representatives_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES app.organization_units(unit_id) ON DELETE RESTRICT;

ALTER TABLE app.achievements DROP CONSTRAINT IF EXISTS achievements_unit_id_fkey;
ALTER TABLE app.achievements
    ADD CONSTRAINT achievements_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES app.organization_units(unit_id) ON DELETE RESTRICT;

ALTER TABLE app.award_applications DROP CONSTRAINT IF EXISTS award_applications_unit_id_fkey;
ALTER TABLE app.award_applications
    ADD CONSTRAINT award_applications_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES app.organization_units(unit_id) ON DELETE RESTRICT;

ALTER TABLE app.award_records DROP CONSTRAINT IF EXISTS award_records_unit_id_fkey;
ALTER TABLE app.award_records
    ADD CONSTRAINT award_records_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES app.organization_units(unit_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION app.prevent_organization_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_id = NEW.unit_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Đơn vị không thể là cha của chính nó';
    END IF;

    IF EXISTS (
        WITH RECURSIVE descendants AS (
            SELECT unit_id
            FROM app.organization_units
            WHERE parent_id = NEW.unit_id
            UNION ALL
            SELECT child.unit_id
            FROM app.organization_units child
            JOIN descendants parent ON child.parent_id = parent.unit_id
        )
        SELECT 1 FROM descendants WHERE unit_id = NEW.parent_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Cập nhật đơn vị tạo chu trình trong cây tổ chức';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_organization_cycle ON app.organization_units;
CREATE TRIGGER trg_prevent_organization_cycle
BEFORE INSERT OR UPDATE OF parent_id ON app.organization_units
FOR EACH ROW EXECUTE FUNCTION app.prevent_organization_cycle();

