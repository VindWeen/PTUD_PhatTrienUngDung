## 2026-11-13T02:30:54Z
You are Challenger 2 for Milestone 4 (Frontend UI Modernization & Routing).

Your State Folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m4_2_gen4
Working Directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

Required Reference Reading:
- ORIGINAL_REQUEST.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- PROJECT.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- SCOPE.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4_gen4\SCOPE.md
- Worker Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m4_1_gen4\handoff.md

Your Mission:
Empirically stress-test the implementation of:
1. Slug validation edge cases in `cvValidation.js` & `CvEditor.jsx`:
   - Test special characters, uppercase characters, accents, leading/trailing hyphens, multiple hyphens, boundary lengths (2 chars, 3 chars, 100 chars, 101 chars), and reserved slugs (`admin`, `api`, `auth`, `login`, `cv`, `me`, `reports`, etc.).
   - Verify fallback UUID link generation when slug is empty.
2. Public CV privacy boundary conditions in `PublicCv.jsx`:
   - Test profile with `is_public = 0`, `is_public = false`, 403 Forbidden, and invalid slugs.
   - Verify the privacy screen renders gracefully with shield/lock icon, courteous Vietnamese notice ("Hồ sơ này hiện đang được đặt ở chế độ riêng tư"), and return button without UI crash.
   - Test rendering of the 3 templates (Academic, Modern, Minimalist) with complete and sparse profile data.
3. Role boundary and route protection tests in `AppRoutes.jsx` & `Sidebar.jsx`:
   - Test accessibility for all 4 roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` and legacy tokens (`LECTURER`, `UNIT_REPRESENTATIVE`).
   - Verify that `/cv/:slug` and `/cv/:id` are completely unauthenticated.
4. Execute empirical tests and scripts to verify runtime behavior.
5. Write your findings and verdict (APPROVE or REQUEST_CHANGES) in c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m4_2_gen4\handoff.md.
6. Notify the caller agent via send_message when complete.
