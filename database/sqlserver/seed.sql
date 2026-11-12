-- Synthetic development data translated from the archived base seed.
-- Runner requires --apply; no DELETE/TRUNCATE and no PostgreSQL access.
SET XACT_ABORT ON;
IF EXISTS(SELECT 1 FROM app.users WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.roles WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.user_roles WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.organization_units WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.user_unit_scopes WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.lecturers WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.lecturer_assignments WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.achievement_categories WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.criteria WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.achievements WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.evidence_files WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.achievement_verifications WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_periods WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_criteria WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_applications WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_records WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.refresh_tokens WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.audit_logs WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.unit_representatives WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.academic_years WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.achievement_types WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_types WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.evidences WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_decisions WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_decision_files WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_record_achievements WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_record_histories WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.notifications WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.achievement_submissions WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.submission_evidence_files WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.achievement_status_histories WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.kpi_goals WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.kpi_results WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.regulation_documents WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.regulation_document_versions WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.regulation_chunks WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_criteria_versions WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_application_inputs WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.award_application_histories WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.evaluation_runs WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.evaluation_criterion_results WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.regulation_chunk_embeddings WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.ai_rag_explanations WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.kpi_recommendations WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.external_kpi_mappings WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.external_kpi_runs WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.external_kpi_records WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.external_kpi_run_items WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.application_reviews WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.application_review_comments WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.personal_calendar_events WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.lecturer_cvs WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
IF EXISTS(SELECT 1 FROM app.criteria_source_rule_history WITH(TABLOCKX,HOLDLOCK)) THROW 51003,N'Demo seed requires every application table to be empty.',1;
SET IDENTITY_INSERT app.roles ON;
INSERT INTO app.roles (role_id, code, name, description, is_active)
VALUES
(1, N'ADMIN', N'Quản trị viên Hệ thống', N'Toàn quyền cấu hình hệ thống, quản lý tài khoản và danh mục. Không có thẩm quyền xét duyệt chuyên môn.', 1),
(2, N'LECTURER', N'Giảng viên / Nghiên cứu viên', N'Khai báo thành tích số, nộp minh chứng và theo dõi đề xuất khen thưởng.', 1),
(3, N'MANAGER', N'Lãnh đạo Đơn vị (Trưởng Khoa/Bộ môn)', N'Thẩm định hồ sơ thành tích và đề xuất khen thưởng trong phạm vi đơn vị và các đơn vị con.', 1),
(4, N'COUNCIL', N'Hội đồng Khen thưởng', N'Hội đồng thi đua cấp Trường thẩm định và phê duyệt quyết định khen thưởng.', 1),
(5, N'UNIT_REPRESENTATIVE', N'Đại diện Đơn vị', N'Kê khai hồ sơ thành tích tập thể trong thời gian được phân công.', 1),
(6, N'RECORDS_OFFICER', N'Cán bộ Văn thư', N'Quản lý quyết định và sổ khen thưởng; không mặc nhiên có quyền thẩm định.', 1);
SET IDENTITY_INSERT app.roles OFF;
SET IDENTITY_INSERT app.organization_units ON;
INSERT INTO app.organization_units (unit_id, code, name, parent_id, type, description, is_active, version)
VALUES
(1, N'FIT', N'Khoa Công nghệ Thông tin', NULL, N'FACULTY', N'Dữ liệu phát triển mô phỏng cho hồ sơ tập thể.', 1, 1),
(2, N'FIT_SE', N'Bộ môn Kỹ thuật Phần mềm', 1, N'DEPARTMENT', N'Dữ liệu phát triển mô phỏng cho hồ sơ tập thể.', 1, 1),
(3, N'FIT_CS', N'Bộ môn Khoa học Máy tính', 1, N'DEPARTMENT', N'Dữ liệu phát triển mô phỏng cho hồ sơ tập thể.', 1, 1),
(4, N'PHARM', N'Khoa Dược', NULL, N'FACULTY', N'Dữ liệu phát triển mô phỏng cho hồ sơ tập thể.', 1, 1);
SET IDENTITY_INSERT app.organization_units OFF;
SET IDENTITY_INSERT app.users ON;
INSERT INTO app.users (user_id, username, email, password_hash, display_name, status, must_change_password, version)
VALUES
(1, N'an.nv', N'an.nv@lhu.edu.vn', N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', N'PGS.TS. Nguyễn Văn An', N'ACTIVE', 0, 1),
(2, N'bich.tt', N'bich.tt@lhu.edu.vn', N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', N'TS. Trần Thị Bích', N'ACTIVE', 0, 1),
(3, N'duc.pm', N'duc.pm@lhu.edu.vn', N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', N'ThS. Phan Minh Đức', N'ACTIVE', 0, 1),
(4, N'cuong.lh', N'cuong.lh@lhu.edu.vn', N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', N'ThS. Lê Hùng Cường', N'ACTIVE', 0, 1);
SET IDENTITY_INSERT app.users OFF;
SET IDENTITY_INSERT app.users ON;
INSERT INTO app.users (user_id,username,email,password_hash,display_name,status)
VALUES (5,N'records.demo',N'records.demo@example.invalid',N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK',N'Cán bộ hồ sơ DEMO',N'ACTIVE');
SET IDENTITY_INSERT app.users OFF;
SET IDENTITY_INSERT app.user_roles ON;
INSERT INTO app.user_roles (user_role_id, user_id, role_id, valid_from, valid_to)
VALUES
(1, 1, 2, DATEADD(year,-1,SYSUTCDATETIME()), NULL), 
(2, 2, 3, DATEADD(year,-1,SYSUTCDATETIME()), NULL), 
(3, 2, 2, DATEADD(year,-1,SYSUTCDATETIME()), NULL), 
(4, 3, 1, DATEADD(year,-1,SYSUTCDATETIME()), NULL), 
(5, 4, 2, DATEADD(year,-1,SYSUTCDATETIME()), NULL), 
(6, 4, 5, CAST(N'2025-01-01 00:00:00' AS DATETIME2(3)), NULL);
SET IDENTITY_INSERT app.user_roles OFF;
INSERT INTO app.user_roles (user_id,role_id,valid_from) VALUES (5,6,DATEADD(day,-1,SYSUTCDATETIME()));
SET IDENTITY_INSERT app.lecturers ON;
INSERT INTO app.lecturers (lecturer_id, user_id, employee_code, full_name, email, phone, title, degree, is_active, version)
VALUES
(1, 1, N'GV00234', N'Nguyễn Văn An', N'an.nv@lhu.edu.vn', N'0901234567', N'Phó Giáo sư', N'Tiến sĩ', 1, 1),
(2, 2, N'GV00112', N'Trần Thị Bích', N'bich.tt@lhu.edu.vn', N'0912345678', N'Trưởng khoa', N'Tiến sĩ', 1, 1),
(3, 3, N'CB00001', N'Phan Minh Đức', N'duc.pm@lhu.edu.vn', N'0923456789', N'Chuyên viên CNTT', N'Thạc sĩ', 1, 1),
(4, 4, N'GV00345', N'Lê Hùng Cường', N'cuong.lh@lhu.edu.vn', N'0934567890', N'Giảng viên', N'Thạc sĩ', 1, 1);
SET IDENTITY_INSERT app.lecturers OFF;
SET IDENTITY_INSERT app.lecturer_assignments ON;
INSERT INTO app.lecturer_assignments (assignment_id, lecturer_id, unit_id, is_primary, valid_from, valid_to, assigned_by)
VALUES
(1, 1, 2, 1, CAST(N'2020-09-01 00:00:00' AS DATETIME2(3)), NULL, 3), 
(2, 2, 1, 1, CAST(N'2020-09-01 00:00:00' AS DATETIME2(3)), NULL, 3), 
(3, 4, 3, 1, CAST(N'2022-09-01 00:00:00' AS DATETIME2(3)), NULL, 3), 
(4, 1, 1, 1, CAST(N'2015-09-01 00:00:00' AS DATETIME2(3)), CAST(N'2020-08-31 23:59:59' AS DATETIME2(3)), 3);
SET IDENTITY_INSERT app.lecturer_assignments OFF;
SET IDENTITY_INSERT app.user_unit_scopes ON;
INSERT INTO app.user_unit_scopes (user_unit_scope_id, user_id, role_id, unit_id, include_descendants, valid_from, valid_to)
VALUES
(1, 2, 3, 1, 1, DATEADD(year,-1,SYSUTCDATETIME()), NULL);
SET IDENTITY_INSERT app.user_unit_scopes OFF;
INSERT INTO app.user_unit_scopes (user_id,role_id,unit_id,include_descendants,valid_from)
VALUES (5,6,1,1,DATEADD(day,-1,SYSUTCDATETIME()));
SET IDENTITY_INSERT app.unit_representatives ON;
INSERT INTO app.unit_representatives (unit_representative_id, user_id, unit_id, valid_from, valid_to, assigned_by)
VALUES
(1, 4, 2, CAST(N'2025-01-01 00:00:00' AS DATETIME2(3)), CAST(N'2027-10-02 00:00:00' AS DATETIME2(3)), 3);
SET IDENTITY_INSERT app.unit_representatives OFF;
SET IDENTITY_INSERT app.academic_years ON;
INSERT INTO app.academic_years (academic_year_id, code, name, start_date, end_date, is_current, is_active)
VALUES
(1, N'2023-2024', N'Năm học 2023 - 2024', CAST(N'2023-09-01' AS DATE), CAST(N'2024-08-31' AS DATE), 0, 1),
(2, N'2024-2025', N'Năm học 2024 - 2025', CAST(N'2024-09-01' AS DATE), CAST(N'2025-08-31' AS DATE), 0, 1),
(3, N'2025-2026', N'Năm học 2025 - 2026', CAST(N'2025-09-01' AS DATE), CAST(N'2026-08-31' AS DATE), 0, 1);
SET IDENTITY_INSERT app.academic_years OFF;
SET IDENTITY_INSERT app.achievement_types ON;
INSERT INTO app.achievement_types (achievement_type_id, code, name, description, applicable_subject_type, is_active)
VALUES
(1, N'RESEARCH_JOURNAL_Q1', N'Bài báo quốc tế ISI/Scopus Q1', N'Dữ liệu danh mục phát triển; tiêu chuẩn xét duyệt do nghiệp vụ cấu hình.', N'LECTURER', 1),
(2, N'RESEARCH_PATENT', N'Bằng độc quyền sáng chế', N'Dữ liệu danh mục phát triển; không tự suy diễn điểm hoặc KPI.', N'BOTH', 1),
(3, N'TEACHING_CURRICULUM', N'Giáo trình được nghiệm thu', N'Dữ liệu danh mục phát triển; cần minh chứng theo hợp đồng nghiệp vụ.', N'LECTURER', 1);
SET IDENTITY_INSERT app.achievement_types OFF;
SET IDENTITY_INSERT app.award_types ON;
INSERT INTO app.award_types (award_type_id, code, name, category, level, applicable_subject_type, description, is_active)
VALUES
(1, N'CSTĐ_CS', N'Chiến sĩ thi đua cơ sở', N'TITLE', N'UNIVERSITY', N'LECTURER', N'Dữ liệu danh mục phát triển; không phải quyết định khen thưởng.', 1),
(2, N'CSTĐ_BGD', N'Chiến sĩ thi đua cấp Bộ', N'TITLE', N'MINISTRY', N'LECTURER', N'Dữ liệu danh mục phát triển; không phải quyết định khen thưởng.', 1),
(3, N'BANG_KHEN_TTCP', N'Bằng khen Thủ tướng Chính phủ', N'REWARD_FORM', N'STATE', N'BOTH', N'Dữ liệu danh mục phát triển; không phải quyết định khen thưởng.', 1),
(4, N'TAP_THE_LĐXS', N'Tập thể lao động xuất sắc', N'TITLE', N'UNIVERSITY', N'UNIT', N'Dữ liệu danh mục phát triển; không phải quyết định khen thưởng.', 1);
SET IDENTITY_INSERT app.award_types OFF;
SET IDENTITY_INSERT app.achievement_categories ON;
INSERT INTO app.achievement_categories (category_id, code, name, description, is_active)
VALUES
(1, N'NCKH', N'Nghiên cứu Khoa học', N'Các đề tài, bài báo khoa học trên các tạp chí và kỷ yếu trong nước, quốc tế', 1),
(2, N'GIANG_DAY', N'Giảng dạy & Đào tạo', N'Các thành tích dạy giỏi, biên soạn giáo trình và hướng dẫn sinh viên NCKH', 1),
(3, N'HOAT_DONG_XH', N'Hoạt động Xã hội & Đoàn thể', N'Đóng góp phục vụ cộng đồng, các hoạt động thiện nguyện và đoàn thể tiêu biểu', 1);
SET IDENTITY_INSERT app.achievement_categories OFF;
SET IDENTITY_INSERT app.criteria ON;
INSERT INTO app.criteria (criterion_id, category_id, code, name, points, requires_evidence, is_active)
VALUES
(1, 1, N'NCKH_ISI', N'Công bố bài báo trên tạp chí ISI/Scopus Q1', 50.00, 1, 1),
(2, 1, N'NCKH_DT_CS', N'Chủ nhiệm đề tài NCKH cấp cơ sở nghiệm thu đạt', 20.00, 1, 1),
(3, 2, N'GD_GVDG', N'Đạt danh hiệu Giảng viên dạy giỏi cấp Trường', 15.00, 1, 1),
(4, 2, N'GD_GIAOTRINH', N'Biên soạn giáo trình được Hội đồng thẩm định nghiệm thu xuất bản', 30.00, 1, 1);
SET IDENTITY_INSERT app.criteria OFF;
SET IDENTITY_INSERT app.award_periods ON;
INSERT INTO app.award_periods (award_period_id, code, name, start_date, end_date, status)
VALUES
(1, N'KT_2025_2026', N'Khen thưởng Tổng kết Năm học 2025 - 2026', DATEADD(day,-30,CAST(SYSUTCDATETIME() AS DATE)), DATEADD(day,60,CAST(SYSUTCDATETIME() AS DATE)), N'OPEN');
SET IDENTITY_INSERT app.award_periods OFF;
SET IDENTITY_INSERT app.users ON;
INSERT app.users(user_id,username,email,password_hash,display_name,status)
VALUES(6,N'council.demo',N'council.demo@example.invalid',N'$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK',N'Hội đồng DEMO',N'ACTIVE');
SET IDENTITY_INSERT app.users OFF;
INSERT app.user_roles(user_id,role_id,valid_from) VALUES(6,4,DATEADD(day,-1,SYSUTCDATETIME()));
INSERT app.user_unit_scopes(user_id,role_id,unit_id,include_descendants,valid_from)
VALUES(6,4,1,1,DATEADD(day,-1,SYSUTCDATETIME()));
IF (SELECT MAX(user_id) FROM app.users) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.users',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(role_id) FROM app.roles) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.roles',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(user_role_id) FROM app.user_roles) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.user_roles',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(unit_id) FROM app.organization_units) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.organization_units',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(user_unit_scope_id) FROM app.user_unit_scopes) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.user_unit_scopes',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(lecturer_id) FROM app.lecturers) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.lecturers',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(assignment_id) FROM app.lecturer_assignments) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.lecturer_assignments',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(category_id) FROM app.achievement_categories) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.achievement_categories',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(criterion_id) FROM app.criteria) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.criteria',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(achievement_id) FROM app.achievements) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.achievements',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(evidence_file_id) FROM app.evidence_files) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.evidence_files',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(verification_id) FROM app.achievement_verifications) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.achievement_verifications',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(award_period_id) FROM app.award_periods) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_periods',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(award_criterion_id) FROM app.award_criteria) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_criteria',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(application_id) FROM app.award_applications) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_applications',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(record_id) FROM app.award_records) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_records',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(refresh_token_id) FROM app.refresh_tokens) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.refresh_tokens',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(audit_id) FROM app.audit_logs) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.audit_logs',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(unit_representative_id) FROM app.unit_representatives) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.unit_representatives',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(academic_year_id) FROM app.academic_years) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.academic_years',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(achievement_type_id) FROM app.achievement_types) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.achievement_types',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(award_type_id) FROM app.award_types) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_types',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(evidence_id) FROM app.evidences) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.evidences',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(decision_id) FROM app.award_decisions) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_decisions',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(decision_file_id) FROM app.award_decision_files) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_decision_files',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(history_id) FROM app.award_record_histories) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_record_histories',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(notification_id) FROM app.notifications) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.notifications',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(submission_id) FROM app.achievement_submissions) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.achievement_submissions',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(history_id) FROM app.achievement_status_histories) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.achievement_status_histories',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(goal_id) FROM app.kpi_goals) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.kpi_goals',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(result_id) FROM app.kpi_results) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.kpi_results',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(document_id) FROM app.regulation_documents) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.regulation_documents',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(version_id) FROM app.regulation_document_versions) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.regulation_document_versions',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(chunk_id) FROM app.regulation_chunks) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.regulation_chunks',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(criteria_version_id) FROM app.award_criteria_versions) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_criteria_versions',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(history_id) FROM app.award_application_histories) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.award_application_histories',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(result_id) FROM app.evaluation_criterion_results) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.evaluation_criterion_results',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(explanation_id) FROM app.ai_rag_explanations) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.ai_rag_explanations',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(record_id) FROM app.external_kpi_records) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.external_kpi_records',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(review_id) FROM app.application_reviews) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.application_reviews',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(comment_id) FROM app.application_review_comments) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.application_review_comments',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(event_id) FROM app.personal_calendar_events) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.personal_calendar_events',RESEED,9) WITH NO_INFOMSGS;
IF (SELECT MAX(history_id) FROM app.criteria_source_rule_history) BETWEEN 1 AND 9 DBCC CHECKIDENT ('app.criteria_source_rule_history',RESEED,9) WITH NO_INFOMSGS;
