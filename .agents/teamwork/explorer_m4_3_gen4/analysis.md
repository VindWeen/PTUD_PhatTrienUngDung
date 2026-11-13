# Comprehensive Analysis: Frontend UI Modernization & Routing (Milestone 4)

**Explorer**: Explorer 3 (Frontend UI Modernization & Routing)  
**Date**: 2026-11-13  
**Scope**: `frontend/src/pages/CvEditor.jsx`, `frontend/src/pages/PublicCv.jsx`, `frontend/src/routes/AppRoutes.jsx`, `frontend/src/components/common/Sidebar.jsx`, `frontend/src/pages/Reports.jsx`, and Build/Test Infrastructure.

---

## 1. Executive Summary

Milestone 4 modernizes the React 18 + Vite SPA to complete the transition from a legacy multi-tier approval system into an individual-centric **Smart Achievement Vault & AI Career Assistant**.

Our investigation has identified several critical legacy artifacts and functional gaps across routing, navigation, CV management, and reporting:
1. **CvEditor.jsx**: Still uses obsolete draft/publish endpoints (`/me/cv/publish`, `/me/cv/unpublish`, `/me/cv/rotate-link`) from a prior milestone. It lacks custom slug configuration, slug format validation, UUID fallback display, public/private toggle switch, 3-template selection (Academic, Modern, Minimalist), and the custom Word `.docx` download action.
2. **PublicCv.jsx**: Route parameter is currently named `:id` rather than `:slug`. When an accessed profile is private (`is_public = 0`), backend returns `{ isPublic: false, message: "Hồ sơ đang ở chế độ riêng tư" }`, which currently causes `<CvDocument />` to render empty/broken fields instead of an elegant privacy screen.
3. **AppRoutes.jsx & Sidebar.jsx**: Navigation and routing still hardcode legacy roles (`LECTURER`, `UNIT_REPRESENTATIVE`, `MANAGER`, `RECORDS_OFFICER`, `COUNCIL`) and legacy routes (`/award-applications`, `/awards`). Standardizing to the 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`), mounting `/cv/:slug` as a public unauthenticated route, and cleaning up legacy routes are required.
4. **Reports.jsx**: Currently contains only static statistical tables and CSV export. It completely lacks the **Unit AI Scan** interface (`POST /api/v1/organizations/units/:id/ai-scan`) required for Department Heads and Faculty Leads to scan personnel against criteria with progress tracking and criteria summary.
5. **Build & Test Infrastructure**: `npm run build` with Vite 6 succeeds cleanly (0 errors). Tests run natively via `node --test`. Test scripts for frontend unit/integration verification need to be formalized.

---

## 2. File-by-File Investigation & Gap Analysis

### 2.1. `frontend/src/pages/CvEditor.jsx`

#### A. Current Implementation Analysis
- **Lines 16-27**: Loads `/me/cv` and saves via `PUT /me/cv` expecting legacy draft structure: `{ education, specialties, skills, certificates, projects, researchLinks, ... }`.
- **Lines 28-51**: Employs legacy lifecycle buttons:
  - `publish` calling `POST /me/cv/publish`
  - `unpublish` calling `POST /me/cv/unpublish`
  - `rotate` calling `POST /me/cv/rotate-link`
  None of these endpoints exist in the refactored `backend/src/modules/cv/cvRoutes.js` (which only supports `GET /me/cv`, `PUT /me/cv`, `GET /me/cv/export-docx`, and `GET /public/cv/:slug`).
- **Lines 106**: Offers only 2 templates: `classic` ("Tối giản") and `modern` ("Hiện đại").
- **Missing Features**:
  1. No input field for **Custom Slug**.
  2. No validation logic for slug (regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3-100 chars, reserved keywords exclusion).
  3. No fallback UUID display when slug is omitted.
  4. No **Public / Private toggle switch** (`isPublic`).
  5. Missing the **Academic (Hàn lâm)** template (only 2 templates present instead of 3).
  6. No **Word `.docx` export action** calling `GET /api/v1/me/cv/export-docx`.
  7. No active achievement selection mechanism aligned with `cvService.getOwnCv` (`selectedAchievementIds`).

#### B. Target Specification Aligned with Backend Contract
The backend CV contract (`backend/src/modules/cv/cvRoutes.js`, `cvService.js`, `cvSchemas.js`) defines:
- **Fetch**: `GET /api/v1/me/cv` returns:
  ```json
  {
    "success": true,
    "data": {
      "profileId": "uuid-string",
      "slug": "nguyen-van-an",
      "templateId": "Modern",
      "isPublic": true,
      "headline": "PGS.TS Giảng viên Khoa CNTT",
      "bio": "Chuyên gia trí tuệ nhân tạo...",
      "version": 1,
      "selectedAchievementIds": [101, 102],
      "contact": { "fullName": "...", "email": "...", "phone": "...", "title": "...", "degree": "...", "unitName": "..." },
      "achievements": [ ...active user achievements... ]
    }
  }
  ```
- **Update**: `PUT /api/v1/me/cv` accepts:
  ```json
  {
    "slug": "nguyen-van-an",
    "templateId": "Modern" | "Academic" | "Minimalist",
    "isPublic": true,
    "headline": "...",
    "bio": "...",
    "selectedAchievementIds": [101, 102]
  }
  ```
- **Export DOCX**: `GET /api/v1/me/cv/export-docx` returns binary Word document (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).

#### C. Required Changes for `CvEditor.jsx`
1. **Slug Management Section**:
   - Slug input with domain prefix badge: `https://lhu.edu.vn/cv/` + `<input value={slug} />`.
   - Real-time client validation:
     - Regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
     - Length: 3 to 100 characters.
     - Reserved keywords check: `admin`, `api`, `auth`, `system`, `login`, `settings`, `help`, `root`, `me`, `public`, `cv`, `profile`, `download`, `export-docx`.
   - Clear feedback text: *"Nếu để trống slug, hệ thống sẽ tự động dùng mã định danh duy nhất (UUID): `/cv/${profileId}`."*
   - Copy Link button: copies full URL (`/cv/${slug || profileId}`).
2. **Public / Private Toggle Switch**:
   - Elegant toggle switch for `isPublic` with status indicator:
     - When `true`: "Hồ sơ công khai — Mọi người có link đều có thể xem CV của bạn."
     - When `false`: "Hồ sơ riêng tư — Người truy cập link sẽ thấy màn hình thông báo hồ sơ riêng tư."
3. **Template Selector (3 Templates)**:
   - **Academic (Hàn lâm)**: Font serif trang trọng, nhấn mạnh học vị, chức danh, phân loại công trình khoa học và số quyết định.
   - **Modern (Hiện đại)**: Bố cục 2 cột năng động, màu nhấn teal/slate, phù hợp chuyển đổi số và công nghệ.
   - **Minimalist (Tối giản)**: Bố cục tinh gọn, khoảng trắng thanh lịch, tập trung vào nội dung cốt lõi.
4. **Export Word (.docx) Action**:
   - Secondary button: `<button onClick={handleExportDocx}><FileDown /> Tải bản Word (.docx)</button>`.
   - Makes authenticated GET call to `/me/cv/export-docx` with `responseType: 'blob'`.
   - Automatically triggers download as `CV_[Tên_Giảng_Viên].docx`.
5. **Achievement Selection List**:
   - Checkbox list rendering user's active achievements from `data.achievements`.
   - Badges showing `ACTIVE` ("Sẵn sàng sử dụng"), recognition year, issuing authority.
   - "Chọn tất cả" / "Bỏ chọn tất cả" utility buttons.
6. **Headline & Bio Inputs**:
   - Headline input (max 255 chars).
   - Bio textarea (max 5000 chars) with character counter.

---

### 2.2. `frontend/src/pages/PublicCv.jsx`

#### A. Current Implementation Analysis
- **Line 7**: Uses `const { id } = useParams();`.
- **Line 13**: Calls `fetch(`${API_BASE_URL}/cv/${encodeURIComponent(id)}`, ...)`
- **Line 15**: Does `setState({ cv: body.data })`.
- **Line 18**: Directly passes `state.cv` to `<CvDocument cv={state.cv} />`.
- **Flaws Identified**:
  1. Route parameter mismatch: if route is configured as `/cv/:slug`, `useParams().id` evaluates to `undefined`. It must handle `slug || id`.
  2. In `backend/src/modules/cv/cvService.js`, when a profile is private (`is_public = 0`), the backend returns status 200 with `{ isPublic: false, message: "Hồ sơ đang ở chế độ riêng tư" }`.
  3. `PublicCv.jsx` treats `{ isPublic: false, message: ... }` as normal CV data and passes it to `<CvDocument />`, which causes a blank page or unhandled TypeError when accessing `cv.workHistory`, `cv.fullName`, etc.
  4. If backend returns 403 or 404, the page shows a bare text `<p role="alert">{state.error}</p>` rather than an elegant, professional privacy view.

#### B. Required Changes for `PublicCv.jsx`
1. Support parameter `const { slug, id } = useParams(); const identifier = slug || id;`.
2. Inspect response data:
   - If `!body.data || body.data.isPublic === false`: render the **Privacy Screen**.
   - If error status is 403 or message contains "riêng tư": render the **Privacy Screen**.
3. **Elegant Privacy Screen**:
   - Soft centered card with `ShieldAlert` or `Lock` icon in gentle slate/indigo tones.
   - Title: "Hồ sơ này hiện đang được đặt ở chế độ riêng tư" (This profile is currently set to private).
   - Subtitle: "Chủ sở hữu hồ sơ đã tạm dừng chia sẻ công khai hoặc giới hạn quyền truy cập."
   - Action: "Về trang chủ" or "Đăng nhập hệ thống" button.
4. **Multi-Template Rendering**:
   - Support rendering the 3 templates (`Academic`, `Modern`, `Minimalist`) cleanly based on `templateId`.
   - Display:
     - Header: Full name, title/degree, unit name, email & phone (if provided), headline, bio.
     - Section: Danh sách thành tích tiêu biểu (title, year, type, decision number).
     - Print / PDF export support (`window.print()`).

---

### 2.3. `frontend/src/routes/AppRoutes.jsx` & `frontend/src/components/common/Sidebar.jsx`

#### A. Current Implementation Analysis
- `AppRoutes.jsx`:
  - **Lines 24-25**: Hardcoded legacy roles:
    `const APP_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'];`
    `const PROFILE_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER'];`
  - **Lines 41**: Legacy landing rule: `(user?.roles || []).some(r => r === 'COUNCIL') ? '/award-applications' : '/me/dashboard'`.
  - **Lines 46**: `<Route path="/cv/:id" element={<PublicCv />} />` (lacks `:slug`).
  - **Lines 61-62**: Legacy routes:
    - `<Route path="awards" element={<RequireRole roles={['RECORDS_OFFICER']}><Awards /></RequireRole>} />`
    - `<Route path="award-applications" element={<RequireRole roles={['LECTURER','UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'COUNCIL']}><AwardApplications /></RequireRole>} />`
  - **Missing**: Calendar route `/calendar` (or `/me/calendar`).
- `Sidebar.jsx`:
  - **Lines 11-23**: Hardcodes old 5 roles across all items and includes `/award-applications` and `/awards`.
  - **Line 45**: Filters `primaryItems` using `['/me/dashboard', '/achievements', '/award-applications', '/kpi', '/awards']`.

#### B. Required Modernization
1. **Standardize on the 4 Standard Roles**:
   - `MEMBER`: General lecturer / member.
   - `DEPARTMENT_HEAD`: Head of Department (Trưởng Bộ môn).
   - `FACULTY_LEAD`: Faculty Dean / Vice Dean (Ban Chủ nhiệm Khoa).
   - `ADMIN`: System administrator.
   *(Note: Include a backward-compatibility normalizer for any session tokens holding `LECTURER`, `UNIT_REPRESENTATIVE`, or `MANAGER` so existing test environments remain fully functional).*
2. **Decommission Legacy Routes**:
   - Remove or redirect `/award-applications` and `/awards` to `/achievements` or `/me/dashboard`.
   - Remove obsolete references to `COUNCIL` and `RECORDS_OFFICER`.
3. **Mount Public Route `/cv/:slug`**:
   - Mount `<Route path="/cv/:slug" element={<PublicCv />} />`.
   - Also keep `<Route path="/cv/:id" element={<PublicCv />} />` or `<Route path="/cv/:slug" element={<PublicCv />} />` to support both custom slugs and fallback UUIDs.
4. **Add Calendar Route**:
   - Mount `<Route path="calendar" element={<RequireRole roles={['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN']}><Calendar /></RequireRole>} />`.
5. **Modernize Sidebar Navigation**:
   - Retain:
     - `/me/dashboard` (Trang chủ)
     - `/me/profile` (Hồ sơ năng lực)
     - `/achievements` (Kho thành tích)
     - `/kpi` (Lộ trình KPI)
     - `/me/ai-forecast` (Trợ lý AI & Khám quy chế)
     - `/calendar` (Lịch hạn nộp & nhắc nhở)
     - `/reports` (Báo cáo & Quét AI Đơn vị)
     - `/regulations` (Kho quy chế)
     - `/organizations` (Cây tổ chức — DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN)
     - `/admin` (Quản trị hệ thống — ADMIN)
   - Remove `/award-applications` and `/awards`.

---

### 2.4. `frontend/src/pages/Reports.jsx`

#### A. Current Implementation Analysis
- Lines 1-544: Focused exclusively on standard achievement and award statistics, filtering by year/unit, and exporting raw CSV.
- **Critical Missing Feature**:
  Requirement R5 and Interface Contract 5 explicitly mandate:
  > "Unit AI Scan interface for Department Heads and Faculty Leads (`POST /api/v1/organizations/units/:id/ai-scan`) with progress bar and criteria summary."
  There is currently **no UI or service integration** for scanning unit personnel against regulations.

#### B. Target Specification Aligned with Backend Contract
The backend endpoint `POST /api/v1/organizations/units/:id/ai-scan` (`backend/src/modules/organizations/organizationRoutes.js`, `organizationService.js` lines 108-230):
- **Authorization**:
  - `DEPARTMENT_HEAD`: Allowed to scan members of their assigned department.
  - `FACULTY_LEAD`: Allowed to scan members of their faculty and all child departments.
  - `ADMIN`: Allowed to scan any unit.
- **Payload**: `{ regulationId: 1 }` (or `{ awardPeriodId: 1 }`).
- **Response Structure**:
  ```json
  {
    "unitId": 2,
    "regulationId": 1,
    "totalMembers": 8,
    "eligibleCount": 5,
    "results": [
      {
        "userId": 10,
        "lecturerId": 10,
        "fullName": "TS. Trần Văn Nam",
        "email": "nam.tv@lhu.edu.vn",
        "unitId": 2,
        "unitName": "Bộ môn Kỹ thuật Phần mềm",
        "percentage": 100,
        "isEligible": true,
        "matched": [
          { "criterionId": 1, "code": "NCKH_01", "name": "Bài báo khoa học ISI/Scopus" },
          { "criterionId": 2, "code": "GD_01", "name": "Đạt chuẩn giờ giảng" }
        ],
        "missing": []
      },
      {
        "userId": 11,
        "lecturerId": 11,
        "fullName": "ThS. Lê Thị Hoa",
        "email": "hoa.lt@lhu.edu.vn",
        "unitId": 2,
        "unitName": "Bộ môn Kỹ thuật Phần mềm",
        "percentage": 50,
        "isEligible": false,
        "matched": [
          { "criterionId": 2, "code": "GD_01", "name": "Đạt chuẩn giờ giảng" }
        ],
        "missing": [
          { "criterionId": 1, "code": "NCKH_01", "name": "Bài báo khoa học ISI/Scopus", "missingCount": 1, "unit": "bài báo" }
        ]
      }
    ]
  }
  ```

#### C. Required Changes for `Reports.jsx`
1. **Add Tabbed View or Sub-Section**:
   - Tab 1: **"Thống kê Thành tích & Khen thưởng"** (existing report & CSV export).
   - Tab 2: **"Quét AI Đơn vị (Unit AI Scan)"** (visible to `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`).
2. **Scan Configuration Card**:
   - Unit selector (defaulting to the user's unit for Department Heads/Faculty Leads, dropdown for Faculty Leads and Admin).
   - Regulation selector (loading active regulations from `regulationsApi.list()`).
   - Action Button: `<button><Bot className="w-4 h-4" /> Bắt đầu Quét AI Đơn vị</button>`.
3. **Execution State & Progress Bar**:
   - Scanning progress indicator with animated progress bar (`0% -> 100%`) and status text: *"Đang quét và đối soát tiêu chí hồ sơ thành tích của các thành viên trong đơn vị..."*.
4. **Criteria & Unit Summary Banner**:
   - 3 Summary KPI cards:
     - **Tổng nhân sự quét**: e.g., 8 thành viên.
     - **Số lượng đủ chuẩn**: e.g., 5 thành viên (62.5% tỷ lệ đủ điều kiện).
     - **Cần hoàn thiện tiêu chí**: e.g., 3 thành viên.
5. **Detailed Member Results Table / Grid**:
   - Column 1: Họ tên giảng viên, email, bộ môn/đơn vị.
   - Column 2: Tỷ lệ hoàn thành tiêu chí (visual progress bar + text, e.g. 100%, 50%).
   - Column 3: Trạng thái điều kiện (Pill: "Đủ chuẩn" [Green] vs "Chưa đạt" [Amber]).
   - Column 4: Tiêu chí đã thỏa (Pills/tags showing criterion code and name).
   - Column 5: Tiêu chí còn thiếu (Tags showing missing count and metric unit, e.g. "Thiếu 1 bài báo").
6. **Filtering & Search in Scan Results**:
   - Toggle to view: "Tất cả" | "Chỉ người đủ chuẩn (100%)" | "Chưa đủ chuẩn (< 100%)".
   - Export scan summary to CSV action.

---

### 2.5. Frontend Build and Test Setup

#### A. Build Tooling
- `frontend/package.json` uses Vite 6.0.7 with `@vitejs/plugin-react` 4.3.4 and Tailwind CSS 3.4.17.
- Verified: Executing `npm run build` in `frontend/` builds production assets in `dist/` without errors:
  - 1722 modules transformed.
  - Zero compilation errors.
  - Generated output bundles: `index.html`, `index.css`, `index.js`, and chunked page assets.

#### B. Test Tooling
- The project relies on Node.js built-in test runner (`node --test`).
- `frontend/tests/readCache.test.mjs` passes 7/7 tests.
- `frontend/src/services/kpiEligibility.test.js` passes 2/2 tests.
- Recommended additions:
  - Add `"test": "node --test tests/**/*.test.mjs src/**/*.test.js tests/**/*.test.js"` to `frontend/package.json`.
  - Create `frontend/tests/cvSlugValidation.test.mjs`: unit testing slug regex, reserved words, and fallback UUID logic.
  - Create `frontend/tests/publicCvPrivacy.test.mjs`: unit testing privacy screen condition handling (`is_public = 0`, 403, and unauthenticated access).

---

## 3. Detailed Proposed Code Changes & Implementation Specs

### 3.1. `frontend/src/pages/CvEditor.jsx`
Replace legacy draft/publish/rotate code with modern state management:

```jsx
// Proposed structure for CvEditor.jsx:
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Award, Check, Copy, ExternalLink, 
  FileDown, Globe, Lock, Save, Sparkles, User, RefreshCw
} from 'lucide-react';
import { request } from '../services/request';
import apiClient from '../services/apiClient';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = [
  'admin', 'api', 'auth', 'system', 'login', 'settings', 
  'help', 'root', 'me', 'public', 'export-docx', 'download', 'cv', 'profile'
];

export default function CvEditor() {
  const [profile, setProfile] = useState(null);
  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState('Modern');
  const [isPublic, setIsPublic] = useState(false);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAchievementIds, setSelectedAchievementIds] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [slugError, setSlugError] = useState('');

  // 1. Fetch current CV Profile
  useEffect(() => {
    loadCvData();
  }, []);

  const loadCvData = async () => {
    setLoading(true);
    try {
      const res = await request({ url: '/me/cv', fresh: true });
      if (res) {
        setProfile(res);
        setSlug(res.slug || '');
        setTemplateId(res.templateId || 'Modern');
        setIsPublic(Boolean(res.isPublic));
        setHeadline(res.headline || '');
        setBio(res.bio || '');
        setSelectedAchievementIds(res.selectedAchievementIds || []);
        setAchievements(res.achievements || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Không thể tải thông tin CV' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Validate Slug
  const handleSlugChange = (val) => {
    const cleaned = val.trim().toLowerCase();
    setSlug(cleaned);
    if (!cleaned) {
      setSlugError('');
      return;
    }
    if (cleaned.length < 3 || cleaned.length > 100) {
      setSlugError('Slug phải từ 3 đến 100 ký tự');
    } else if (!SLUG_REGEX.test(cleaned)) {
      setSlugError('Slug chỉ chứa chữ thường, số và dấu gạch ngang (-)');
    } else if (RESERVED_SLUGS.includes(cleaned)) {
      setSlugError('Slug này trùng với từ khóa hệ thống, vui lòng chọn tên khác');
    } else {
      setSlugError('');
    }
  };

  // 3. Save CV Profile
  const handleSave = async () => {
    if (slugError) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        slug: slug || null,
        templateId,
        isPublic,
        headline,
        bio,
        selectedAchievementIds
      };
      await request({ method: 'PUT', url: '/me/cv', data: payload });
      setMessage({ type: 'success', text: 'Đã lưu thay đổi hồ sơ CV thành công!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Lỗi khi lưu CV' });
    } finally {
      setSaving(false);
    }
  };

  // 4. Export DOCX
  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      const response = await apiClient.get('/me/cv/export-docx', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CV_${profile?.contact?.fullName?.replace(/\s+/g, '_') || 'LHU'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi khi xuất file Word: ' + (err.message || 'Không thể tạo file') });
    } finally {
      setExportingDocx(false);
    }
  };

  // Public URL identifier: slug || profileId
  const publicIdentifier = slug || profile?.profileId;
  const publicUrl = publicIdentifier ? `${window.location.origin}/cv/${publicIdentifier}` : '';

  // ... Render UI with Slug Input, Public Toggle, 3 Templates, Achievements Checkbox, and Word Export button ...
}
```

### 3.2. `frontend/src/pages/PublicCv.jsx`
Implement the privacy screen fallback and template selector:

```jsx
// Proposed structure for PublicCv.jsx:
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../services/apiConfig';
import { ShieldAlert, Award, Mail, Phone, Building2, User, FileText, ArrowLeft, Printer } from 'lucide-react';

export default function PublicCv() {
  const { slug, id } = useParams();
  const identifier = slug || id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/public/cv/${encodeURIComponent(identifier)}`, {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit'
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error('CV không tồn tại hoặc đã ngừng chia sẻ');
        if (res.status === 403) return { isPublic: false };
        return res.json();
      })
      .then((body) => {
        const cvData = body.data || body;
        setData(cvData);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [identifier]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-300 animate-pulse">Đang tải hồ sơ CV...</p>
      </main>
    );
  }

  // ELEGANT PRIVACY SCREEN
  if (data && data.isPublic === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Hồ sơ này hiện đang được đặt ở chế độ riêng tư
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Chủ sở hữu hồ sơ đã tạm dừng chia sẻ công khai. Vui lòng liên hệ giảng viên nếu bạn cần tiếp cận thông tin này.
          </p>
          <div className="pt-4">
            <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition">
              <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-rose-600 font-semibold">{error || 'Không tìm thấy hồ sơ'}</p>
          <Link to="/" className="text-sm text-teal-600 underline">Quay lại trang chủ</Link>
        </div>
      </main>
    );
  }

  // Render CV according to templateId: 'Academic' | 'Modern' | 'Minimalist'
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 py-10 px-4">
      {/* ... Template Specific Layout Rendering ... */}
    </main>
  );
}
```

### 3.3. `frontend/src/routes/AppRoutes.jsx` & `frontend/src/components/common/Sidebar.jsx`

#### AppRoutes.jsx Edits:
- Role definition update:
  ```jsx
  export const STANDARD_ROLES = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
  export const UNIT_LEAD_ROLES = ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
  export const ADMIN_ONLY = ['ADMIN'];
  ```
- Public CV route mapping:
  ```jsx
  <Route path="/cv/:slug" element={<PublicCv />} />
  <Route path="/cv/:id" element={<PublicCv />} />
  ```
- Cleaned routes:
  - Remove `<Route path="awards" ... />`
  - Remove `<Route path="award-applications" ... />`
  - Add `<Route path="calendar" element={<RequireRole roles={STANDARD_ROLES}><Calendar /></RequireRole>} />`
  - Retain `/reports` for all authenticated members, with Unit AI Scan tab active for `UNIT_LEAD_ROLES`.

#### Sidebar.jsx Edits:
```jsx
const navItems = [
  { to: '/me/dashboard', icon: Home, label: 'Trang chủ', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/me/profile', icon: User, label: 'Hồ sơ năng lực', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/achievements', icon: Award, label: 'Kho thành tích', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/kpi', icon: Target, label: 'Mục tiêu / KPI', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/me/ai-forecast', icon: Cpu, label: 'Trợ lý AI & Khám quy chế', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/calendar', icon: Calendar, label: 'Lịch nhắc nhở', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo & Quét AI', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/regulations', icon: BookOpen, label: 'Kho quy định', roles: ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/organizations', icon: Building2, label: 'Cây tổ chức', roles: ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'] },
  { to: '/admin', icon: Shield, label: 'Quản trị hệ thống', roles: ['ADMIN'] },
];
```

### 3.4. `frontend/src/pages/Reports.jsx`
Add the Unit AI Scan tab and execution interface:

```jsx
// Addition inside Reports.jsx:
const [activeTab, setActiveTab] = useState('statistics'); // 'statistics' | 'ai_scan'
const [scanUnitId, setScanUnitId] = useState('');
const [scanRegulationId, setScanRegulationId] = useState('');
const [scanning, setScanning] = useState(false);
const [scanProgress, setScanProgress] = useState(0);
const [scanResult, setScanResult] = useState(null);

const canScanUnit = roles.some(r => ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'].includes(r));

const runUnitAiScan = async () => {
  if (!scanUnitId || !scanRegulationId) return;
  setScanning(true);
  setScanProgress(20);
  try {
    const progressTimer = setInterval(() => {
      setScanProgress(p => (p < 90 ? p + 15 : p));
    }, 200);

    const res = await request({
      method: 'POST',
      url: `/organizations/units/${scanUnitId}/ai-scan`,
      data: { regulationId: Number(scanRegulationId) }
    });
    clearInterval(progressTimer);
    setScanProgress(100);
    setScanResult(res);
  } catch (err) {
    setError(err);
  } finally {
    setScanning(false);
  }
};
```
And render:
- Progress bar while `scanning === true`.
- KPI summary: Total Members, Eligible Count (`scanResult.eligibleCount`), % Eligible.
- Table listing all members with completion percentages, matched criteria tags, and missing criteria tags.

---

## 4. Synthesis & Recommendations for Implementation

| Priority | Component | Action Summary |
|----------|-----------|----------------|
| **P0** | `AppRoutes.jsx` | Mount `/cv/:slug` unauthenticated; update to 4 standard roles; remove legacy paperwork routes (`/awards`, `/award-applications`). |
| **P0** | `PublicCv.jsx` | Read `:slug` parameter; intercept `isPublic === false` (or 403) to display elegant Privacy Screen; render 3 templates. |
| **P0** | `CvEditor.jsx` | Wire up Custom Slug input + regex/reserved validation; public toggle switch; 3 template selection; Word `.docx` download action (`GET /me/cv/export-docx`). |
| **P1** | `Sidebar.jsx` | Standardize on 4 roles; remove `/award-applications` and `/awards`; add `/calendar`. |
| **P1** | `Reports.jsx` | Add "Quét AI Đơn vị (Unit AI Scan)" for Department Heads and Faculty Leads (`POST /organizations/units/:id/ai-scan`) with progress bar and criteria summary. |
| **P2** | `frontend/package.json` & test scripts | Add `"test"` script for Node native test runner; add unit test suites for slug validation and privacy fallback. |

This concludes the detailed analysis. The worker can execute directly from this specification.
