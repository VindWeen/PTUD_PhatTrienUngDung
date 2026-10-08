-- SYNTHETIC ONLY. Runner rewrites app to a newly created isolated schema.
-- Never execute against shared app schema. No KPI/provider/award claims.
INSERT INTO app.roles(role_id,code,name) VALUES
 (1,'ADMIN','Synthetic admin'),(2,'LECTURER','Synthetic lecturer'),
 (3,'MANAGER','Synthetic manager'),(4,'UNIT_REPRESENTATIVE','Synthetic representative'),
 (5,'RECORDS_OFFICER','Synthetic records'),(6,'COUNCIL','Synthetic council');
INSERT INTO app.organization_units(unit_id,code,name,type)
 SELECT n,'W5-U-'||n,'Đơn vị mô phỏng '||n,'FACULTY' FROM generate_series(1,10) n;
INSERT INTO app.users(user_id,username,email,password_hash,display_name,status)
 SELECT n,'w5-'||n,'w5-'||n||'@example.invalid','disabled-synthetic-password',
 'Giảng viên mô phỏng '||n,'ACTIVE' FROM generate_series(1,100) n;
INSERT INTO app.lecturers(lecturer_id,user_id,employee_code,full_name,email)
 SELECT n,n,'W5-GV-'||n,'Giảng viên mô phỏng '||n,'w5-'||n||'@example.invalid' FROM generate_series(1,100) n;
INSERT INTO app.user_roles(user_id,role_id,valid_from)
 SELECT n,2,'2020-01-01' FROM generate_series(1,100) n;
INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES
 (1,1,'2020-01-01'),(2,3,'2020-01-01'),(3,4,'2020-01-01'),(4,5,'2020-01-01'),(5,6,'2020-01-01');
INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by)
 SELECT n,1+(n-1)%10,TRUE,'2020-01-01',1 FROM generate_series(1,100) n;
INSERT INTO app.user_unit_scopes(user_id,role_id,unit_id,valid_from) VALUES
 (2,3,1,'2020-01-01'),(4,5,1,'2020-01-01');
INSERT INTO app.unit_representatives(user_id,unit_id,valid_from,assigned_by) VALUES(3,1,'2020-01-01',1);
INSERT INTO app.achievement_types(achievement_type_id,code,name,applicable_subject_type)
 VALUES(1,'W5-SYNTHETIC','Loại thành tích mô phỏng','BOTH');
INSERT INTO app.achievements(achievement_id,lecturer_id,unit_id,context_unit_id,achievement_type_id,title,recognition_year,status,created_by)
 SELECT n,CASE WHEN n%5<>0 THEN 1+(n-1)%100 END,
 CASE WHEN n%5=0 THEN 1+(n/5-1)%10 END,
 CASE WHEN n%5=0 THEN 1+(n/5-1)%10 ELSE 1+(n-1)%10 END,1,
 CASE WHEN n=1 THEN E'=1+1, "mô phỏng"\nDòng 2' ELSE 'W5 SYNTHETIC thành tích '||n END,
 2020+(n/100)%7,(ARRAY['DRAFT','SUBMITTED','VERIFIED','REJECTED','REVOKED','NEED_CORRECTION'])[1+n%6],
 CASE WHEN n%5=0 THEN 3 ELSE 1+(n-1)%100 END
 FROM generate_series(1,5000) n;
-- Keep generated IDs usable for subsequent CRUD in the disposable dataset.
DO $$ DECLARE t text; c text; BEGIN
 FOR t,c IN SELECT * FROM (VALUES ('users','user_id'),('lecturers','lecturer_id'),
 ('roles','role_id'),('organization_units','unit_id'),('achievement_types','achievement_type_id'),
 ('achievements','achievement_id')) AS identities(t,c) LOOP
 EXECUTE format('SELECT setval(pg_get_serial_sequence(%L,%L), (SELECT MAX(%I) FROM app.%I))','app.'||t,c,c,t);
 END LOOP;
END $$;
