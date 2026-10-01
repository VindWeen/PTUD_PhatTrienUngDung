-- ==============================================================================
-- SUPABASE SEED DATA (supabase/seed.sql)
-- Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
-- ==============================================================================

-- 1. Xóa dữ liệu cũ theo thứ tự ràng buộc khóa ngoại (Foreign Keys)
TRUNCATE TABLE app.audit_logs CASCADE;
TRUNCATE TABLE app.refresh_tokens CASCADE;
TRUNCATE TABLE app.award_records CASCADE;
TRUNCATE TABLE app.award_applications CASCADE;
TRUNCATE TABLE app.award_criteria CASCADE;
TRUNCATE TABLE app.award_periods CASCADE;
TRUNCATE TABLE app.achievement_verifications CASCADE;
TRUNCATE TABLE app.evidence_files CASCADE;
TRUNCATE TABLE app.achievements CASCADE;
TRUNCATE TABLE app.criteria CASCADE;
TRUNCATE TABLE app.achievement_categories CASCADE;
TRUNCATE TABLE app.lecturer_assignments CASCADE;
TRUNCATE TABLE app.lecturers CASCADE;
TRUNCATE TABLE app.user_unit_scopes CASCADE;
TRUNCATE TABLE app.organization_units CASCADE;
TRUNCATE TABLE app.user_roles CASCADE;
TRUNCATE TABLE app.roles CASCADE;
TRUNCATE TABLE app.users CASCADE;

-- 2. Khởi tạo Vai trò Hệ thống (Roles)
INSERT INTO app.roles (role_id, code, name, description, is_active)
OVERRIDING SYSTEM VALUE VALUES
(1, 'ADMIN', 'Quản trị viên Hệ thống', 'Toàn quyền cấu hình hệ thống, quản lý tài khoản và danh mục. Không có thẩm quyền xét duyệt chuyên môn.', TRUE),
(2, 'LECTURER', 'Giảng viên / Nghiên cứu viên', 'Khai báo thành tích số, nộp minh chứng và theo dõi đề xuất khen thưởng.', TRUE),
(3, 'MANAGER', 'Lãnh đạo Đơn vị (Trưởng Khoa/Bộ môn)', 'Thẩm định hồ sơ thành tích và đề xuất khen thưởng trong phạm vi đơn vị và các đơn vị con.', TRUE),
(4, 'COUNCIL', 'Hội đồng Khen thưởng', 'Hội đồng thi đua cấp Trường thẩm định và phê duyệt quyết định khen thưởng.', TRUE);

ALTER SEQUENCE app.roles_role_id_seq RESTART WITH 10;

-- 3. Khởi tạo Cơ cấu Đơn vị Tổ chức (Organization Units)
INSERT INTO app.organization_units (unit_id, code, name, parent_id, type, is_active, version)
OVERRIDING SYSTEM VALUE VALUES
(1, 'FIT', 'Khoa Công nghệ Thông tin', NULL, 'FACULTY', TRUE, 1),
(2, 'FIT_SE', 'Bộ môn Kỹ thuật Phần mềm', 1, 'DEPARTMENT', TRUE, 1),
(3, 'FIT_CS', 'Bộ môn Khoa học Máy tính', 1, 'DEPARTMENT', TRUE, 1),
(4, 'PHARM', 'Khoa Dược', NULL, 'FACULTY', TRUE, 1);

ALTER SEQUENCE app.organization_units_unit_id_seq RESTART WITH 10;

-- 4. Khởi tạo Tài khoản Người dùng (Users) - Mật khẩu mặc định: demo1234
-- Hash: $2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK
INSERT INTO app.users (user_id, username, email, password_hash, display_name, status, must_change_password, version)
OVERRIDING SYSTEM VALUE VALUES
(1, 'an.nv', 'an.nv@lhu.edu.vn', '$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', 'PGS.TS. Nguyễn Văn An', 'ACTIVE', FALSE, 1),
(2, 'bich.tt', 'bich.tt@lhu.edu.vn', '$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', 'TS. Trần Thị Bích', 'ACTIVE', FALSE, 1),
(3, 'duc.pm', 'duc.pm@lhu.edu.vn', '$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', 'ThS. Phan Minh Đức', 'ACTIVE', FALSE, 1),
(4, 'cuong.lh', 'cuong.lh@lhu.edu.vn', '$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK', 'ThS. Lê Hùng Cường', 'ACTIVE', FALSE, 1);

ALTER SEQUENCE app.users_user_id_seq RESTART WITH 10;

-- 5. Gán Vai trò cho Người dùng (User Roles)
INSERT INTO app.user_roles (user_role_id, user_id, role_id, valid_from, valid_to)
OVERRIDING SYSTEM VALUE VALUES
(1, 1, 2, NOW() - INTERVAL '1 year', NULL), -- an.nv: LECTURER
(2, 2, 3, NOW() - INTERVAL '1 year', NULL), -- bich.tt: MANAGER
(3, 2, 2, NOW() - INTERVAL '1 year', NULL), -- bich.tt: LECTURER
(4, 3, 1, NOW() - INTERVAL '1 year', NULL), -- duc.pm: ADMIN (Tuyệt đối không gán MANAGER)
(5, 4, 2, NOW() - INTERVAL '1 year', NULL); -- cuong.lh: LECTURER

ALTER SEQUENCE app.user_roles_user_role_id_seq RESTART WITH 10;

-- 6. Khởi tạo Hồ sơ Giảng viên (Lecturers)
INSERT INTO app.lecturers (lecturer_id, user_id, employee_code, full_name, email, phone, title, degree, is_active, version)
OVERRIDING SYSTEM VALUE VALUES
(1, 1, 'GV00234', 'Nguyễn Văn An', 'an.nv@lhu.edu.vn', '0901234567', 'Phó Giáo sư', 'Tiến sĩ', TRUE, 1),
(2, 2, 'GV00112', 'Trần Thị Bích', 'bich.tt@lhu.edu.vn', '0912345678', 'Trưởng khoa', 'Tiến sĩ', TRUE, 1),
(3, 3, 'CB00001', 'Phan Minh Đức', 'duc.pm@lhu.edu.vn', '0923456789', 'Chuyên viên CNTT', 'Thạc sĩ', TRUE, 1),
(4, 4, 'GV00345', 'Lê Hùng Cường', 'cuong.lh@lhu.edu.vn', '0934567890', 'Giảng viên', 'Thạc sĩ', TRUE, 1);

ALTER SEQUENCE app.lecturers_lecturer_id_seq RESTART WITH 10;

-- 7. Phân công Công tác Đơn vị của Giảng viên (Assignments)
INSERT INTO app.lecturer_assignments (assignment_id, lecturer_id, unit_id, is_primary, valid_from, valid_to)
OVERRIDING SYSTEM VALUE VALUES
(1, 1, 2, TRUE, NOW() - INTERVAL '1 year', NULL), -- PGS. An thuộc BM KTPM (FIT_SE)
(2, 2, 1, TRUE, NOW() - INTERVAL '1 year', NULL), -- TS. Bích thuộc Khoa CNTT (FIT)
(3, 4, 3, TRUE, NOW() - INTERVAL '1 year', NULL); -- ThS. Cường thuộc BM KHMT (FIT_CS)

ALTER SEQUENCE app.lecturer_assignments_assignment_id_seq RESTART WITH 10;

-- 8. Gán Phạm vi Quản lý Đơn vị (User Unit Scopes)
-- TS. Bích có thẩm quyền quản lý Khoa CNTT (Unit #1) kèm theo các Bộ môn con (include_descendants = TRUE)
INSERT INTO app.user_unit_scopes (user_unit_scope_id, user_id, role_id, unit_id, include_descendants, valid_from, valid_to)
OVERRIDING SYSTEM VALUE VALUES
(1, 2, 3, 1, TRUE, NOW() - INTERVAL '1 year', NULL);

ALTER SEQUENCE app.user_unit_scopes_user_unit_scope_id_seq RESTART WITH 10;

-- 9. Danh mục Nhóm Thành tích & Tiêu chí
INSERT INTO app.achievement_categories (category_id, code, name, description, is_active)
OVERRIDING SYSTEM VALUE VALUES
(1, 'NCKH', 'Nghiên cứu Khoa học', 'Các đề tài, bài báo khoa học trên các tạp chí và kỷ yếu trong nước, quốc tế', TRUE),
(2, 'GIANG_DAY', 'Giảng dạy & Đào tạo', 'Các thành tích dạy giỏi, biên soạn giáo trình và hướng dẫn sinh viên NCKH', TRUE),
(3, 'HOAT_DONG_XH', 'Hoạt động Xã hội & Đoàn thể', 'Đóng góp phục vụ cộng đồng, các hoạt động thiện nguyện và đoàn thể tiêu biểu', TRUE);

ALTER SEQUENCE app.achievement_categories_category_id_seq RESTART WITH 10;

INSERT INTO app.criteria (criterion_id, category_id, code, name, points, requires_evidence, is_active)
OVERRIDING SYSTEM VALUE VALUES
(1, 1, 'NCKH_ISI', 'Công bố bài báo trên tạp chí ISI/Scopus Q1', 50.00, TRUE, TRUE),
(2, 1, 'NCKH_DT_CS', 'Chủ nhiệm đề tài NCKH cấp cơ sở nghiệm thu đạt', 20.00, TRUE, TRUE),
(3, 2, 'GD_GVDG', 'Đạt danh hiệu Giảng viên dạy giỏi cấp Trường', 15.00, TRUE, TRUE),
(4, 2, 'GD_GIAOTRINH', 'Biên soạn giáo trình được Hội đồng thẩm định nghiệm thu xuất bản', 30.00, TRUE, TRUE);

ALTER SEQUENCE app.criteria_criterion_id_seq RESTART WITH 10;

-- 10. Đợt Xét duyệt Khen thưởng
INSERT INTO app.award_periods (award_period_id, code, name, start_date, end_date, status)
OVERRIDING SYSTEM VALUE VALUES
(1, 'KT_2025_2026', 'Khen thưởng Tổng kết Năm học 2025 - 2026', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 'OPEN');

ALTER SEQUENCE app.award_periods_award_period_id_seq RESTART WITH 10;
