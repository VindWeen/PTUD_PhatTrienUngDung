# Handoff Report: Milestone 3 — CV Profiles, Custom Slug & DOCX Export

**Agent**: `teamwork_explorer_m3_2` (Explorer 2 for Milestone 3)  
**Date**: 2026-11-12T19:25:00Z  
**Target Milestone**: Milestone 3 — Backend Extended Modules (Feature 9 & Feature 10)  
**Recipient**: Parent Orchestrator (`c4f8ee2a-a6b8-4150-930d-200ed34209c4`) & Worker M3

---

## 1. Observation

### 1.1 Current Codebase State in `backend/src/modules/cv/`
- **Files Present**:
  - `backend/src/modules/cv/cvRoutes.js` (6,579 bytes, last modified 11/11/2026 4:10 PM)
  - `backend/src/modules/cv/cvSchemas.js` (2,706 bytes, last modified 11/11/2026 4:01 PM)
- **Files Missing**:
  - `backend/src/modules/cv/cvService.js` (DOES NOT EXIST)
  - `backend/src/modules/cv/cvRepository.js` (DOES NOT EXIST)
  - `backend/src/modules/cv/templates/` (DOES NOT EXIST; no `default_cv.docx` on disk)
- **Detailed Examination of Legacy `cvRoutes.js`**:
  - Line 12: `achievementsFor` queries `WHERE lecturer_id=$1 AND status='VERIFIED'`. This is incompatible with M1/M2 refactored achievements, which are stored with `status = 'ACTIVE'` and accessible via `created_by = $userId` or `lecturer_id`.
  - Line 15: Queries deprecated table `app.lecturer_cvs` (`draft`, `published`, `published_draft`, `public_id` 32-char hex).
  - Line 18: Route `GET /cv/:id` only accepts 32-char hex string `/^[a-f0-9]{32}$/` and queries `app.lecturer_cvs.public_id`.
  - Line 26: Route `GET /me/cv` queries `app.lecturer_cvs`.
  - Line 32: Route `PUT /me/cv` inserts/updates `app.lecturer_cvs`.
  - **No endpoint for**:
    - `GET /api/v1/public/cv/:slug` (unauthenticated slug access with UUID fallback)
    - `GET /api/v1/me/cv/export-docx` (DOCX binary export)
    - `PUT /api/v1/me/cv/profile` or modern `app.cv_profiles` integration.
- **Detailed Examination of Legacy `cvSchemas.js`**:
  - Line 6: `template: z.enum(['classic', 'modern'])` — does not match the 3 required web templates (`Modern`, `Academic`, `Minimalist`, plus optional `Creative`).
  - Does not validate slug format (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`), slug length (3–100 characters), or reserved keywords (`['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root']`).

### 1.2 Database Schema & Migration 005
- Migration file: `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`.
- Lines 84–99:
  ```sql
  CREATE TABLE app.cv_profiles (
    profile_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id BIGINT NOT NULL CONSTRAINT fk_cv_profiles_user FOREIGN KEY REFERENCES app.users(user_id),
    slug NVARCHAR(100) NULL,
    is_public BIT NOT NULL DEFAULT 0,
    template_id NVARCHAR(50) NOT NULL DEFAULT N'standard',
    custom_docx_storage_key NVARCHAR(500) NULL,
    selected_achievement_ids NVARCHAR(MAX) NULL,
    bio NVARCHAR(MAX) NULL,
    headline NVARCHAR(255) NULL,
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX uq_cv_profiles_slug ON app.cv_profiles(slug) WHERE slug IS NOT NULL;
  ```
- **Live Database Inspection**:
  - Executed query `SELECT TOP 5 * FROM app.cv_profiles` on live database. Confirmed table exists and already contains 5 profile records for users 1, 2, and 3.
  - Confirmed unique index `uq_cv_profiles_slug` is active on column `slug` WHERE `slug IS NOT NULL`.

### 1.3 Dependency Packages for Word Export
- In `backend/package.json`:
  - `"docxtemplater": "^3.71.1"` (Installed in `backend/node_modules/docxtemplater`)
  - `"pizzip": "^3.3.0"` (Installed in `backend/node_modules/pizzip`)
- **Empirical Execution Test**:
  - Created `.agents/teamwork/sub_orch_m3_gen3/explorer_2/test_docx.mjs` using `Docxtemplater` (`docxtemplater/js/docxtemplater.js`) and `PizZip` (`pizzip/js/index.js`).
  - Programmatically synthesized Word OpenXML files (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) containing Vietnamese unicode diacritics and scientific symbols (`PGS.TS. Nguyễn Văn An — Nghiên cứu AI, Học sâu & IoT y tế (Σ, α, β)`).
  - Generated binary buffer: length 1,240 bytes.
  - Verification:
    - Magic bytes: `0x50, 0x4B, 0x03, 0x04` (`PK\x03\x04`).
    - UInt32LE check: `buffer.readUInt32LE(0) === 0x04034b50` (identical to requirement in E2E tests).
    - Inner OpenXML validation: `buffer.toString('utf-8').includes('word/document.xml') === true`.

### 1.4 Route Mounting & Interface Contracts
- In `backend/src/app.js`:
  - Line 60: `const apiPrefix = config.API_PREFIX || '/api/v1';`
  - Line 67: `app.use(apiPrefix, cvRoutes);`
- Thus, any route in `cvRoutes.js` registered as:
  - `router.get('/public/cv/:slug', ...)` -> mapped to `/api/v1/public/cv/:slug`.
  - `router.get('/cv/:slug', ...)` -> mapped to `/api/v1/cv/:slug` (matches frontend `PublicCv.jsx`).
  - `router.get('/me/cv', ...)` -> mapped to `/api/v1/me/cv`.
  - `router.put('/me/cv', ...)` -> mapped to `/api/v1/me/cv`.
  - `router.get('/me/cv/export-docx', ...)` -> mapped to `/api/v1/me/cv/export-docx`.
- Exact E2E Test Contract Requirements (from `tests/e2e/tier1-feature-coverage.test.js`, `tier2-boundary-corner.test.js`, `tier3-cross-feature.test.js`, `tier4-application-scenarios.test.js`):
  1. `PUT /api/v1/me/cv`:
     - Payload: `{ slug, templateId, isPublic, headline, bio, contact, selectedAchievementIds, version }`.
     - Validates slug: regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 3-100, rejects reserved keywords (`admin`, `api`, `auth`, `system`, `login`, `settings`, `help`, `root`).
     - Validates templateId: must be one of `['Modern', 'Academic', 'Minimalist', 'Creative']` (case-sensitive or normalized).
     - Returns: `{ success: true, data: { version, slug, isPublic, ... } }`.
  2. `GET /api/v1/public/cv/:slug`:
     - Unauthenticated (no Bearer token required).
     - If non-existent slug/ID: HTTP 404 `{ success: false, message: 'CV không tồn tại hoặc đã ngừng chia sẻ' }`.
     - If `is_public === false` (or 0): HTTP 200 `{ success: true, data: { isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' } }` (sensitive achievements and contact hidden).
     - If `is_public === true` (or 1): HTTP 200 `{ success: true, data: { isPublic: true, slug, headline, bio, templateId, contact, achievements: [...] } }`.
  3. `GET /api/v1/me/cv/export-docx`:
     - Authenticated.
     - Returns HTTP 200 binary stream:
       - Header `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
       - Header `Content-Disposition: attachment; filename="CV_Export.docx"`.
       - Magic bytes `0x04034b50` (`PK\x03\x04`).

---

## 2. Logic Chain

1. **Premise 1**: The database schema in `005_refactor_personal_vault_and_cv.sql` provides the modern table `app.cv_profiles` with `slug`, `is_public`, `template_id`, `headline`, `bio`, `selected_achievement_ids`, `version`.
2. **Premise 2**: The legacy `cvRoutes.js` and `cvSchemas.js` in `backend/src/modules/cv/` target the old table `app.lecturer_cvs` and status `'VERIFIED'`, and lack all Milestone 3 features (custom slug, public unauthenticated route, template selection, and DOCX export).
3. **Premise 3**: Worker M3 was paused before touching the CV module (`progress.md` showed it was on KPI bridge task).
4. **Premise 4**: Both `docxtemplater` and `pizzip` are already installed and tested. Using an in-memory OpenXML XML template generator with optional disk file template override provides 100% resilience against missing or corrupted `.docx` files on disk.
5. **Premise 5**: Both the frontend (`PublicCv.jsx` calling `/api/v1/cv/:id`) and the E2E test harness (`testClient.js` calling `/api/v1/public/cv/:slug` and `/api/v1/me/cv`) can be simultaneously satisfied by defining both route paths (`/public/cv/:slug` and `/cv/:slug`) pointing to the same controller method.
6. **Conclusion**: Worker M3 must implement `cvRepository.js`, `cvService.js`, update `cvSchemas.js`, rewrite `cvRoutes.js`, supply a default template/in-memory generator, and write unit/integration tests in `backend/tests/cv-profile.test.js`.

---

## 3. Caveats

1. **Profile Uniqueness per User**: Table `app.cv_profiles` has a unique constraint on `slug` (`uq_cv_profiles_slug`), but not on `user_id`. `cvRepository` must implement UPSERT logic: `SELECT TOP 1 * FROM app.cv_profiles WHERE user_id = @userId ORDER BY updated_at DESC`, updating the existing profile or inserting a new one if none exists.
2. **Achievement Scope for CV**: The user's CV must list active achievements where `status = 'ACTIVE'` and `deleted_at IS NULL`, matching either `created_by = @userId` or `lecturer_id = (SELECT lecturer_id FROM app.lecturers WHERE user_id = @userId)`. If `selected_achievement_ids` is provided as an array, the service must filter to only those IDs; otherwise, include all active achievements.
3. **Error Response Format**: While `errorHandler.js` returns `{ success: false, error: { message, code } }`, E2E tests assert on `res.data.message`. Therefore, route controllers should return `{ success: false, message: '...' }` on validation and not-found errors to maintain compatibility across both mock and live modes.

---

## 4. Conclusion & Recommended Architecture

Worker M3 should implement the CV module according to the following concrete design:

### 4.1 Module Architecture
```
backend/src/modules/cv/
├── cvRepository.js       # Database operations on app.cv_profiles, app.achievements, app.users
├── cvService.js          # Business logic, slug validation, docx generation with docxtemplater + pizzip
├── cvSchemas.js          # Zod validation schemas for slug, templates, profile update
├── cvRoutes.js           # Express route definitions for /public/cv/:slug, /me/cv, /me/cv/export-docx
└── templates/
    └── default_cv.docx   # Word template with {fullName}, {headline}, {bio}, {#achievements}{title}{/achievements}
```

### 4.2 Proposed Code Implementation

#### A. `cvSchemas.js`
```javascript
import { z } from 'zod';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root'];
export const VALID_TEMPLATES = ['Modern', 'Academic', 'Minimalist', 'Creative', 'standard'];

export const updateCvSchema = z.object({
  slug: z.string().trim()
    .min(3, 'Độ dài slug phải từ 3 đến 100 ký tự')
    .max(100, 'Độ dài slug phải từ 3 đến 100 ký tự')
    .regex(SLUG_REGEX, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
    .refine(s => !RESERVED_SLUGS.includes(s.toLowerCase()), 'Slug không được sử dụng các từ khóa hệ thống đã được bảo lưu')
    .optional(),
  templateId: z.enum(['Modern', 'Academic', 'Minimalist', 'Creative', 'standard'], {
    errorMap: () => ({ message: 'Mẫu giao diện CV không hợp lệ' })
  }).optional(),
  isPublic: z.boolean().optional(),
  headline: z.string().max(255).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  contact: z.object({
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().optional().nullable(),
  }).optional().nullable(),
  selectedAchievementIds: z.array(z.number().int().positive()).optional().nullable(),
  version: z.number().int().nonnegative().optional(),
});
```

#### B. `cvRepository.js`
Key functions:
- `findProfileByUserId(userId)`: returns profile row.
- `findProfileBySlugOrId(slugOrId)`: checks UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`), checks numeric / `user-${id}`, or checks `slug`.
- `upsertProfile(userId, data)`: updates existing row with concurrency version check (`version = version + 1`), or inserts new record.
- `getUserActiveAchievements(userId, selectedIds = null)`: queries `app.achievements` where `status = 'ACTIVE'` and `deleted_at IS NULL`.
- `getUserContact(userId)`: queries `app.users` and `app.lecturers` for `full_name`, `email`, `phone`.

#### C. `cvService.js`
Key functions:
- `getPublicCv(slugOrId)`:
  - If not found -> throw `NotFoundError('CV không tồn tại hoặc đã ngừng chia sẻ')`.
  - If `!profile.isPublic` -> return `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }`.
  - If `profile.isPublic` -> return `{ isPublic: true, slug, headline, bio, templateId, contact, achievements }`.
- `updateCv(userId, payload)`: validates and upserts profile, returns `{ version, slug, isPublic }`.
- `exportCvDocx(userId)`: fetches profile, contact, achievements; compiles via `PizZip` and `Docxtemplater`; handles Vietnamese Unicode and 0 achievements gracefully; returns `{ buffer, filename: 'CV_Export.docx' }`.

#### D. `cvRoutes.js`
```javascript
import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import cvService from './cvService.js';

const router = express.Router();

// Public routes (unauthenticated)
router.get('/public/cv/:slug', async (req, res, next) => {
  try {
    const data = await cvService.getPublicCv(req.params.slug);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
});
// Alias for frontend compatibility
router.get('/cv/:slug', async (req, res, next) => {
  try {
    const data = await cvService.getPublicCv(req.params.slug);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// Authenticated routes
router.get('/me/cv', authenticate, async (req, res, next) => {
  try {
    const data = await cvService.getOwnCv(req.user.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});
router.get('/me/cv/profile', authenticate, async (req, res, next) => {
  try {
    const data = await cvService.getOwnCv(req.user.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});
router.put('/me/cv', authenticate, async (req, res, next) => {
  try {
    const data = await cvService.updateCv(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === 'ZodError' || err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});
router.put('/me/cv/profile', authenticate, async (req, res, next) => {
  try {
    const data = await cvService.updateCv(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === 'ZodError' || err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});
router.get('/me/cv/export-docx', authenticate, async (req, res, next) => {
  try {
    const { buffer, filename } = await cvService.exportCvDocx(req.user.userId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename || 'CV_Export.docx'}"`,
      'Content-Length': buffer.length,
    });
    res.status(200).send(buffer);
  } catch (err) { next(err); }
});

export default router;
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Unit Test Suite for CV Module**:
   ```powershell
   node --test backend/tests/cv-profile.test.js
   ```
   Must test:
   - Slug validation (regex, length boundaries 2, 3, 100, 101, reserved words).
   - Template ID validation (`Modern`, `Academic`, `Minimalist`, `Creative`, rejection of invalid template).
   - Public vs private profile access (`isPublic: false` returns privacy message, `isPublic: true` returns achievements).
   - DOCX binary export headers, PK zip magic bytes `0x04034b50`, and `word/document.xml` presence.
   - 0 achievements export test (graceful empty array handling without crash).
   - Unicode Vietnamese diacritics and scientific symbols.

2. **Integration with E2E Suite**:
   ```powershell
   node tests/e2e/runner.js --tier=1
   node tests/e2e/runner.js --tier=2
   node tests/e2e/runner.js
   ```
   All 171 tests across 42 suites must pass with 0 failures and 0 skips.

3. **Live Database Integration Verification**:
   ```powershell
   node -e "import('./backend/src/utils/dbHelper.js').then(async m => { const r = await m.query('SELECT TOP 1 * FROM app.cv_profiles'); console.log('Live CV Profile:', r.rows[0]); process.exit(0); })"
   ```
   Ensures SQL Server connection and table integrity.

### 5.2 Invalidation Conditions
- Any route returning HTML or crashing with unhandled rejection on malformed slug or missing template.
- Export DOCX failing to return MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document` or failing PK zip signature check (`0x50 0x4b 0x03 0x04`).
- Private CV (`is_public = 0`) leaking achievement records or contact information to unauthenticated visitors.
