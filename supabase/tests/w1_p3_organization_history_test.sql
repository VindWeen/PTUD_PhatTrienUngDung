BEGIN;

DO $$
DECLARE
  actor_id BIGINT;
  lecturer_ref BIGINT;
  old_unit BIGINT;
  new_unit BIGINT;
  criterion_ref BIGINT;
  achievement_ref BIGINT;
  before_context BIGINT;
  after_context BIGINT;
BEGIN
  SELECT user_id INTO actor_id FROM app.users ORDER BY user_id LIMIT 1;
  SELECT lecturer_id INTO lecturer_ref FROM app.lecturers ORDER BY lecturer_id LIMIT 1;
  SELECT unit_id INTO old_unit FROM app.organization_units ORDER BY unit_id LIMIT 1;
  SELECT unit_id INTO new_unit FROM app.organization_units WHERE unit_id <> old_unit ORDER BY unit_id LIMIT 1;
  SELECT criterion_id INTO criterion_ref FROM app.criteria ORDER BY criterion_id LIMIT 1;

  IF actor_id IS NULL OR lecturer_ref IS NULL OR old_unit IS NULL OR new_unit IS NULL OR criterion_ref IS NULL THEN
    RAISE EXCEPTION 'Seed test thiếu user/lecturer/tối thiểu 2 units/criterion';
  END IF;

  INSERT INTO app.achievements (criterion_id, lecturer_id, context_unit_id, title, achievement_date)
  VALUES (criterion_ref, lecturer_ref, old_unit, '[W1-P3 TEST] context bất biến', CURRENT_DATE)
  RETURNING achievement_id, context_unit_id INTO achievement_ref, before_context;

  UPDATE app.lecturer_assignments
     SET valid_to = '2098-01-01T00:00:00Z'
   WHERE lecturer_id = lecturer_ref AND is_primary = TRUE AND valid_to IS NULL;
  INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from, assigned_by)
  VALUES (lecturer_ref, new_unit, TRUE, '2098-01-01T00:00:00Z', actor_id);

  SELECT context_unit_id INTO after_context FROM app.achievements WHERE achievement_id = achievement_ref;
  IF after_context <> before_context THEN
    RAISE EXCEPTION 'context_unit_id lịch sử bị thay đổi khi điều chuyển';
  END IF;

  BEGIN
    DELETE FROM app.organization_units WHERE unit_id = old_unit;
    RAISE EXCEPTION 'Đã xóa được đơn vị có dữ liệu lịch sử';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
