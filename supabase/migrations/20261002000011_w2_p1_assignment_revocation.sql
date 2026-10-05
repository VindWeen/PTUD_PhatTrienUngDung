-- Preserve cancelled/future assignments and retain their original validity periods.
ALTER TABLE app.user_roles ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE app.user_unit_scopes ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE app.unit_representatives ADD COLUMN revoked_at TIMESTAMPTZ;
-- Exclude revoked representative history from the overlap policy.
ALTER TABLE app.unit_representatives DROP CONSTRAINT ex_unit_representatives_no_overlap;
ALTER TABLE app.unit_representatives ADD CONSTRAINT ex_unit_representatives_no_overlap
  EXCLUDE USING gist (unit_id WITH =, tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz), '[)') WITH &&)
  WHERE (revoked_at IS NULL);

-- Preserve confirmed Vietnamese catalog codes while enforcing case-insensitive uniqueness.
CREATE UNIQUE INDEX uq_academic_years_code_normalized ON app.academic_years (UPPER(code));
CREATE UNIQUE INDEX uq_achievement_types_code_normalized ON app.achievement_types (UPPER(code));
CREATE UNIQUE INDEX uq_award_types_code_normalized ON app.award_types (UPPER(code));
