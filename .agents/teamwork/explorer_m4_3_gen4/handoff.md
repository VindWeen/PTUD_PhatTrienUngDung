# Handoff Report: Frontend UI Modernization & Routing (Milestone 4)

**Agent**: Explorer 3 (`explorer_m4_3_gen4`)  
**Recipient**: Milestone 4 Worker / Sub-Orchestrator  
**Date**: 2026-11-13  
**Status**: COMPLETE

---

## 1. Observation

Direct observations from examining the codebase, backend interfaces, and build/test commands:

1. **`frontend/src/pages/CvEditor.jsx`**:
   - Lines 16-51: Employs deprecated lifecycle methods and endpoints (`POST /me/cv/publish`, `POST /me/cv/unpublish`, `POST /me/cv/rotate-link`) that no longer exist in the backend router `backend/src/modules/cv/cvRoutes.js`.
   - Line 106: Templates offered are limited to `[['classic', 'Tối giản', ...], ['modern', 'Hiện đại', ...]]`. The "Academic (Hàn lâm)" template is completely missing.
   - Missing fields: No custom slug input or validation; no fallback UUID display; no public/private toggle switch; no Word `.docx` download action calling `GET /api/v1/me/cv/export-docx`.

2. **`frontend/src/pages/PublicCv.jsx`**:
   - Line 7: `const { id } = useParams();` expects param name `id` rather than `slug`.
   - Line 13: Calls `fetch(`${API_BASE_URL}/cv/${encodeURIComponent(id)}`, ...)` without handling privacy responses.
   - In `backend/src/modules/cv/cvService.js` (lines 58-63), when `!profile.is_public`, the service returns:
     ```javascript
     if (!profile.is_public) {
       return {
         isPublic: false,
         message: 'Hồ sơ đang ở chế độ riêng tư',
       };
     }
     ```
   - In `PublicCv.jsx` line 18: `state.cv` is passed directly to `<CvDocument cv={state.cv} />`. When `isPublic: false`, `<CvDocument>` receives no achievements or contact details, resulting in an unhandled visual error or blank screen.

3. **`frontend/src/routes/AppRoutes.jsx` & `frontend/src/components/common/Sidebar.jsx`**:
   - `AppRoutes.jsx` lines 24-25: Hardcodes legacy roles `const APP_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'];` and `PROFILE_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER'];`.
   - `AppRoutes.jsx` line 46: Mounts only `<Route path="/cv/:id" element={<PublicCv />} />` instead of `<Route path="/cv/:slug" ... />`.
   - `AppRoutes.jsx` lines 61-62: Registers legacy paperwork/council routes (`awards` for `RECORDS_OFFICER` and `award-applications` for `COUNCIL`).
   - `Sidebar.jsx` lines 11-23: Maps navigation items using legacy roles and legacy routes (`/award-applications`, `/awards`).
   - Neither `AppRoutes.jsx` nor `Sidebar.jsx` registers the personal Calendar route (`/calendar`).

4. **`frontend/src/pages/Reports.jsx`**:
   - Lines 1-544: Only implements static achievement/award tables and general CSV export (`reportsApi.exportCsv`).
   - The Unit AI Scan feature defined in R5 and Interface Contract 5 (`POST /api/v1/organizations/units/:id/ai-scan`) is entirely absent from `Reports.jsx`.

5. **Build and Test Tooling**:
   - Executing `cd frontend; npm run build` successfully transformed 1722 modules with 0 errors, generating production assets in `dist/`.
   - Node native test commands execute cleanly:
     - `node --test frontend/tests/readCache.test.mjs` (7 pass, 0 fail).
     - `node --test frontend/src/services/kpiEligibility.test.js` (2 pass, 0 fail).

---

## 2. Logic Chain

1. **CvEditor.jsx Refactoring**:
   - *From Observation 1*: The backend contract (`cvRoutes.js` and `cvService.js`) provides `GET /me/cv`, `PUT /me/cv`, and `GET /me/cv/export-docx`.
   - *Reasoning*: Because the backend already validates slug format via `slugSchema` (`SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 3-100 chars, no reserved words) and handles `templateId` ('Academic', 'Modern', 'Minimalist'), `CvEditor.jsx` must present a client-side slug input with validation, a fallback UUID prompt when blank, a public toggle switch, 3 template cards, and an export button invoking `GET /me/cv/export-docx` with `responseType: 'blob'`.

2. **PublicCv.jsx Privacy Handling**:
   - *From Observation 2*: When a profile has `is_public = 0`, the backend returns `{ isPublic: false, message: "Hồ sơ đang ở chế độ riêng tư" }`.
   - *Reasoning*: If `PublicCv.jsx` attempts to render `<CvDocument cv={state.cv} />`, missing fields cause broken layouts. By intercepting `data?.isPublic === false` (or HTTP 403), `PublicCv.jsx` can render a polite, styled privacy screen with a shield/lock icon and a link back to homepage, fully satisfying R4 and Acceptance Criteria.
   - Furthermore, reading both `slug` and `id` from `useParams()` ensures `/cv/:slug` and `/cv/:id` work seamlessly without broken parameters.

3. **Routing and Navigation Streamlining**:
   - *From Observation 3*: The project has completed refactoring the database (M1) and backend (M2, M3) to 4 standard roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`, while retiring legacy paperwork/council approval flows.
   - *Reasoning*: `AppRoutes.jsx` and `Sidebar.jsx` must be updated to use these 4 roles. Legacy `/awards` and `/award-applications` routes must be removed. `/cv/:slug` must be mounted as an unauthenticated route, and `/calendar` must be added to route configurations.

4. **Unit AI Scan Integration in Reports.jsx**:
   - *From Observation 4*: `POST /api/v1/organizations/units/:id/ai-scan` is implemented in `organizationRoutes.js` and tested in `backend/tests/unit-ai-scan.test.js`.
   - *Reasoning*: Adding a "Quét AI Đơn vị" tab to `Reports.jsx` for `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN` will allow unit leaders to select their department/faculty, pick a regulation, run the scan with an animated progress bar, and review a summary banner (total members, eligible count, % eligible) plus a detailed breakdown table showing matched vs missing criteria per lecturer.

5. **Build and Verification Integrity**:
   - *From Observation 5*: Vite build and Node native tests run cleanly.
   - *Reasoning*: New UI additions can be verified via `cd frontend; npm run build` and newly created unit tests for slug validation and privacy fallback.

---

## 3. Caveats

1. **Role Backward Compatibility**: Existing stored tokens or mock fixture users may still retain strings like `LECTURER` or `UNIT_REPRESENTATIVE`. A helper function in `AppRoutes.jsx` and `Sidebar.jsx` that maps `LECTURER` -> `MEMBER`, `UNIT_REPRESENTATIVE` -> `DEPARTMENT_HEAD`, and `MANAGER` -> `FACULTY_LEAD` should be included to guarantee zero regressions during transition.
2. **Template Styling Scope**: In `PublicCv.jsx`, the 3 templates (`Academic`, `Modern`, `Minimalist`) should vary in visual structure (font choice, layout columns, header prominence) while sharing the same underlying data attributes (`fullName`, `title`, `degree`, `unitName`, `achievements`).
3. **Co-working with Explorers 1 and 2**: Explorer 1 is covering `Achievements.jsx` & `AIForecast.jsx`; Explorer 2 is covering `Kpi.jsx` & `Calendar.jsx`. Our route definitions in `AppRoutes.jsx` and `Sidebar.jsx` must include `/calendar` so that Explorer 2 / Worker's Calendar implementation is properly accessible.

---

## 4. Conclusion

The modern frontend architecture for Milestone 4 is cleanly achievable through targeted edits in 5 primary files:
1. `frontend/src/pages/CvEditor.jsx`: Modernize to single `GET`/`PUT` flow, add slug validation with UUID fallback, public/private toggle, 3 templates, active achievement picker, and Word `.docx` download.
2. `frontend/src/pages/PublicCv.jsx`: Support `/cv/:slug` parameter, add elegant Privacy Screen when `isPublic === false` or 403, and render the 3 templates.
3. `frontend/src/routes/AppRoutes.jsx`: Decommission legacy council/award routes, standardize on 4 roles, mount unauthenticated `/cv/:slug`, and add `/calendar`.
4. `frontend/src/components/common/Sidebar.jsx`: Modernize menu to 4 roles and active modules, adding `/calendar` and removing paperwork routes.
5. `frontend/src/pages/Reports.jsx`: Implement Unit AI Scan interface (`POST /organizations/units/:id/ai-scan`) with progress bar and criteria summary.

Detailed code designs and replacement snippets are documented in `analysis.md`.

---

## 5. Verification Method

1. **Build Verification**:
   ```powershell
   cd frontend
   npm run build
   ```
   *Expected*: Vite builds production bundle into `dist/` with zero TypeScript/JSX/Rollup compilation errors.

2. **Native Test Execution**:
   ```powershell
   node --test frontend/tests/readCache.test.mjs
   node --test frontend/src/services/kpiEligibility.test.js
   ```
   *Expected*: All existing tests pass.

3. **New Frontend Unit Tests (to be added by worker)**:
   - `frontend/tests/cvSlugValidation.test.mjs`: validates regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, min 3 max 100, and reserved slugs (`admin`, `api`, `auth`, `login`, `settings`, etc.).
   - `frontend/tests/publicCvPrivacy.test.mjs`: asserts that `isPublic: false` renders privacy screen with message *"Hồ sơ này hiện đang được đặt ở chế độ riêng tư"*.
   Run via:
   ```powershell
   node --test frontend/tests/cvSlugValidation.test.mjs frontend/tests/publicCvPrivacy.test.mjs
   ```

4. **Integration Invalidation Conditions**:
   - If `npm run build` fails with missing imports or syntax errors.
   - If `/cv/:slug` redirects to login or requires authentication.
   - If a private profile (`is_public = 0`) renders broken CV elements instead of the privacy card.
   - If `GET /api/v1/me/cv/export-docx` is not triggered by the download button in `CvEditor.jsx`.
   - If `Reports.jsx` does not permit `DEPARTMENT_HEAD` or `FACULTY_LEAD` to execute Unit AI Scan.
