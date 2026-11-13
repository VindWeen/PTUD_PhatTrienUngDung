# Comprehensive Analysis: Achievement Vault UI & AI Vision OCR Integration

**Author**: Explorer 1 (Milestone 4: Frontend UI Modernization & Routing)  
**Date**: 2026-11-13  
**Working Directory**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**Target Files**:
- `frontend/src/pages/Achievements.jsx`
- `frontend/src/services/achievementsApi.js`
- `frontend/src/components/PortfolioAchievements.jsx`

---

## 1. Executive Summary

This investigation analyzes the current state of `Achievements.jsx` and related frontend modules in light of the system refactoring into a **Smart Achievement Vault & Career Assistant** (Requirement R1, Acceptance Criteria R1).

The backend layer (Milestones 1 & 2) has already transitioned completely:
1. Newly created achievements are saved with status `'ACTIVE'` immediately without any administrative approval (`achievementRepository.js:398`).
2. Legacy approval routes (`/submit`, `/verify`, `/request-correction`, `/reject`, `/cancel`, `/revoke`, `/resubmit`, `/replace`) in `achievementRoutes.js` return `HTTP 410 Gone` with a decommissioned notice.
3. The backend endpoint `POST /api/v1/achievements/ai-extract` is fully implemented and tested, supporting Groq Vision (`llama-3.2-11b-vision-preview`) and Gemini Vision (`gemini-1.5-flash`), with a guaranteed safe fallback (`fallback: true`) when no API keys are present or documents cannot be parsed.

However, the current frontend UI in `Achievements.jsx` (1,627 lines) still exhibits legacy approval workflow logic:
- `STATUS_BADGES` completely lacks an entry for `ACTIVE` ("Sẵn sàng sử dụng").
- `canCreate` checks only legacy roles `['LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN']`, blocking standard users with the `MEMBER`, `DEPARTMENT_HEAD`, and `FACULTY_LEAD` roles.
- The UI still renders legacy workflow tabs ('Cần hoàn thiện', 'Chờ thẩm định') and approval action buttons ('Nộp thẩm định', 'Xác nhận', 'Yêu cầu bổ sung', 'Thu hồi').
- The creation modal frames achievements as "Bản nháp" ("Lưu bản nháp").
- There is **no AI Vision certificate upload modal** or API method in `achievementsApi.js` to trigger `POST /api/v1/achievements/ai-extract`.

This document specifies the exact component updates, auto-fill mappings, graceful error fallbacks, and code diffs required for the Worker agent to implement.

---

## 2. Current State Analysis

### 2.1 Status Badges & The Missing `ACTIVE` Status
In `frontend/src/pages/Achievements.jsx` lines 42–50:
```javascript
const STATUS_BADGES = {
  DRAFT: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  SUBMITTED: { label: 'Chờ duyệt', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  NEED_CORRECTION: { label: 'Cần bổ sung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  VERIFIED: { label: 'Đã xác nhận', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  REJECTED: { label: 'Từ chối', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  REVOKED: { label: 'Đã thu hồi', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};
```
**Problem**: When a user creates an achievement, the backend returns `status: "ACTIVE"`. Because `STATUS_BADGES['ACTIVE']` is `undefined`, the UI falls back to `{ label: 'ACTIVE', color: 'bg-slate-100 text-slate-700' }` rather than the required `"Sẵn sàng sử dụng"` green badge.

### 2.2 Role Permissions (`canCreate`)
In `frontend/src/pages/Achievements.jsx` line 58:
```javascript
const canCreate = userRoles.some(role => ['LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'].includes(role));
```
**Problem**: The standardized 4 roles are `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` (plus legacy `LECTURER`, `UNIT_REPRESENTATIVE`). Any user with role `MEMBER` is currently locked out of creating achievements (`canCreate === false`). In the personal vault paradigm, **any authenticated user** must be able to create achievements.

### 2.3 Legacy Approval Actions vs. Decommissioned Backend
In `frontend/src/pages/Achievements.jsx`:
- `renderActions` (lines 553–580) provides action buttons:
  - `submit`: 'Nộp thẩm định' (calling `achievementsApi.submit`)
  - `cancel`: 'Rút hồ sơ'
  - `review`: 'Xác nhận', 'Yêu cầu bổ sung', 'Từ chối'
  - `revoke`: 'Thu hồi xác nhận'
  - `replace`: 'Tạo bản thay thế'
- Detail Modal (lines 1049–1120):
  - Displays "Quy chế Liêm chính: Bạn là người kê khai..." banner.
  - Displays "Thao tác thẩm định: Xác nhận (VERIFY), Yêu cầu bổ sung, Từ chối".
  - Displays "Nộp duyệt hồ sơ" / "Gửi lại hồ sơ" button.
- Action Modal (lines 1509–1624):
  - Submits to decommissioned endpoints.

**Problem**: If clicked, the backend immediately responds with `410 Gone`. Users in the Smart Achievement Vault do not need any administrative approval. Their achievements are immediately ready to be evaluated against regulations or linked into their CV.

### 2.4 Workflow Tabs vs. Vault View
In `frontend/src/pages/Achievements.jsx` lines 67 & 584–591:
```javascript
const [activeTab, setActiveTab] = useState(canReview ? 'PENDING' : 'ACTIONABLE');
```
Tabs:
- `ACTIONABLE`: 'Cần hoàn thiện'
- `PENDING`: 'Chờ thẩm định' / 'Đang xét'
- `VERIFIED`: 'Đã xác nhận'
- `ENDED`: 'Từ chối / Thu hồi / Hủy'
- `ALL`: 'Tất cả'
- `TRASH`: 'Thùng rác'

**Problem**: The UI presents an administrative evaluation queue rather than a personal Achievement Vault. The default view should display all active achievements (`ALL` or `ACTIONABLE` labeled as "Kho thành tích" / "Sẵn sàng sử dụng"), with clean access to "Thùng rác".

---

## 3. Backend AI Vision OCR Contract

### 3.1 Endpoint Specification
- **Method & Path**: `POST /api/v1/achievements/ai-extract`
- **Authentication**: Bearer JWT (supported roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`, `LECTURER`, `UNIT_REPRESENTATIVE`)
- **Request Format**: `multipart/form-data` with field `file` (Buffer up to 10 MB, image formats `image/jpeg`, `image/png`, or `application/pdf`).

### 3.2 Response Payloads
#### Scenario A: Successful AI Vision Extraction
```json
{
  "success": true,
  "data": {
    "title": "Chiến sĩ thi đua cấp cơ sở năm học 2024-2025",
    "recognitionYear": 2025,
    "issueDate": "2025-06-20",
    "issuer": "Hiệu trưởng Trường Đại học Lạc Hồng",
    "decisionNumber": "1245/QĐ-ĐHLH",
    "category": "TEACHING"
  },
  "fallback": false,
  "message": "Trích xuất thông tin bằng khen thành công từ AI Vision."
}
```

#### Scenario B: Graceful Fallback (Unreadable image, missing API key, or non-parseable document)
```json
{
  "success": true,
  "data": null,
  "fallback": true,
  "message": "Chưa cấu hình API Key AI Vision (GROQ_API_KEY / GEMINI_API_KEY). Vui lòng tự nhập thông tin bằng khen/chứng chỉ."
}
```

#### Scenario C: Server Error / 503 Service Unavailable / Timeout
- HTTP status 503 or 500, or network exception.
- Frontend must catch this error, avoid crashing or blocking the user, display a polite alert, and transition smoothly to manual data entry.

---

## 4. UI Architecture & Flow Design for AI Vision

```
+-----------------------------------------------------------------------------+
| Achievements.jsx Page Header                                                |
| [✨ Quét AI Bằng khen]   [+ Kê khai Thành tích]   [Thùng rác]              |
+-----------------------------------------------------------------------------+
        |                                       |
        v                                       v
+-------------------------------+       +------------------------------------+
| AI Vision OCR Modal           |       | Achievement Form Modal             |
| - Drag & drop / file picker   |       | - Subject (LECTURER / UNIT)        |
| - Image / PDF preview         |       | - Achievement Type                 |
| - "Quét bằng AI Vision" btn   |       | - Title                            |
+-------------------------------+       | - Contribution Role                |
        |                               | - Recognition Year                 |
        | [Calls POST /ai-extract]      | - Start / End Date                 |
        v                               | - Description                      |
+-------------------------------+       | - Attached Evidence Files          |
| Result Handler:               |       +------------------------------------+
| - Success -> auto-fill fields |                           ^
|   & attach file to evidence   |                           |
|   -> Open Form Modal          |---------------------------+
|                               |
| - Fallback / Error -> toast   |
|   & keep file attached        |
|   -> Open Form Modal (manual) |
+-------------------------------+
```

### 4.1 Field Mapping Logic
| AI Vision Extracted Field | Form State Field (`formData`) | Fallback / Logic |
|---|---|---|
| `title` | `formData.title` | User's file name or empty string if null |
| `recognitionYear` | `formData.recognitionYear` | Extracted integer, or year from `issueDate`, or `new Date().getFullYear()` |
| `issueDate` | `formData.startDate` & `formData.endDate` | Set date string (YYYY-MM-DD) |
| `issuer` & `decisionNumber` | `formData.description` | Formatted into description: `Đơn vị cấp: ${issuer}\nSố quyết định: ${decisionNumber}` |
| `category` | `formData.achievementTypeId` | Auto-match catalog type by keyword (`RESEARCH` -> `JOURNAL`/`PATENT`, `TEACHING` -> `CURRICULUM`/`TEACH`). Defaults to first type |
| Uploaded file | `pendingEvidences` | **Automatically added to evidence list** with title set to `data.title || file.name`. The user does not need to re-upload |

---

## 5. Detailed Implementation Blueprint

### 5.1 Step 1: Update `frontend/src/services/achievementsApi.js`
Add `aiExtract` method to `achievementsApi`:
```javascript
aiExtract: async (file) => {
  if (USE_FIXTURES) {
    return {
      success: true,
      data: {
        title: 'Bằng khen Chiến sĩ thi đua cấp cơ sở',
        recognitionYear: 2025,
        issueDate: '2025-05-10',
        issuer: 'Hiệu trưởng Trường Đại học Lạc Hồng',
        decisionNumber: '1245/QĐ-ĐHLH',
        category: 'TEACHING',
      },
      fallback: false,
      message: 'Trích xuất thông tin thành tựu thành công qua Vision AI',
    };
  }
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/achievements/ai-extract', formData, {
    headers: { 'Content-Type': undefined },
  });
},
```

### 5.2 Step 2: Refactor `frontend/src/pages/Achievements.jsx`

#### A. Status Badges
Add `ACTIVE` configuration:
```javascript
const STATUS_BADGES = {
  ACTIVE: {
    label: 'Sẵn sàng sử dụng',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800',
  },
  DRAFT: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  SUBMITTED: { label: 'Chờ duyệt', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  NEED_CORRECTION: { label: 'Cần bổ sung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  VERIFIED: { label: 'Đã xác nhận', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  REJECTED: { label: 'Từ chối', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  REVOKED: { label: 'Đã thu hồi', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};
```

#### B. Permission Check
Update `canCreate`:
```javascript
const canCreate = Boolean(user);
```

#### C. Action Buttons in Table & Detail
In `renderActions`:
Retain only:
- `Eye`: "Xem chi tiết"
- `Edit2`: "Chỉnh sửa" (when permitted)
- `Trash2`: "Xóa thành tích" (moves to trash)
- `RotateCcw`: "Khôi phục" (if in trash)
Decommission and remove `submit`, `verify`, `requestCorrection`, `reject`, `cancel`, `revoke`.

#### D. AI Vision OCR Modal Implementation
Add modal state:
```javascript
const [aiModalOpen, setAiModalOpen] = useState(false);
const [aiFile, setAiFile] = useState(null);
const [aiPreview, setAiPreview] = useState(null);
const [aiScanning, setAiScanning] = useState(false);
const [aiNotice, setAiNotice] = useState(null); // { type: 'success' | 'info' | 'error', message: string }
```

Add scanning handler:
```javascript
const handleAiExtract = async () => {
  if (!aiFile) return;
  setAiScanning(true);
  try {
    const res = await achievementsApi.aiExtract(aiFile);
    const fileToKeep = aiFile;

    if (res.fallback || !res.data) {
      // Graceful fallback: do NOT block
      setAiModalOpen(false);
      openCreateModal();
      // Keep file attached in pending evidences
      setPendingEvidences([
        {
          id: crypto.randomUUID(),
          file: fileToKeep,
          title: fileToKeep.name.replace(/\.[^/.]+$/, '').slice(0, 255),
          description: 'Minh chứng tệp đính kèm',
        },
      ]);
      setAiNotice({
        type: 'info',
        message: res.message || 'Trợ lý AI chưa thể đọc được nội dung chứng chỉ. Tệp đã được đính kèm vào minh chứng, vui lòng tự điền thông tin vào biểu mẫu.',
      });
    } else {
      // Successful extraction
      const extracted = res.data;
      setAiModalOpen(false);
      openCreateModal();

      // Find matching type
      let matchedTypeId = types[0]?.achievement_type_id || '';
      if (extracted.category === 'SCIENTIFIC_RESEARCH') {
        const found = types.find(t => /RESEARCH|NCKH|JOURNAL|PATENT/i.test(t.code || t.name));
        if (found) matchedTypeId = found.achievement_type_id;
      } else if (extracted.category === 'TEACHING') {
        const found = types.find(t => /TEACH|CURRICULUM|GIANG_DAY/i.test(t.code || t.name));
        if (found) matchedTypeId = found.achievement_type_id;
      }

      setFormData(prev => ({
        ...prev,
        title: extracted.title || prev.title,
        recognitionYear: extracted.recognitionYear || prev.recognitionYear,
        startDate: extracted.issueDate || prev.startDate,
        endDate: extracted.issueDate || prev.endDate,
        contributionRole: extracted.category === 'SCIENTIFIC_RESEARCH' ? 'Tác giả' : prev.contributionRole,
        description: [
          extracted.issuer ? `Đơn vị cấp: ${extracted.issuer}` : null,
          extracted.decisionNumber ? `Số quyết định: ${extracted.decisionNumber}` : null,
        ].filter(Boolean).join('\n') || prev.description,
        achievementTypeId: matchedTypeId,
      }));

      setPendingEvidences([
        {
          id: crypto.randomUUID(),
          file: fileToKeep,
          title: extracted.title || fileToKeep.name.slice(0, 255),
          description: `Minh chứng trích xuất từ AI Vision (Số QĐ: ${extracted.decisionNumber || '—'})`,
        },
      ]);

      setAiNotice({
        type: 'success',
        message: '✨ AI Vision đã trích xuất thành công thông tin bằng khen! Vui lòng kiểm tra lại thông tin và nhấn "Lưu vào Kho Thành tích".',
      });
    }
  } catch (err) {
    // 503 or Network error: graceful fallback
    const fileToKeep = aiFile;
    setAiModalOpen(false);
    openCreateModal();
    if (fileToKeep) {
      setPendingEvidences([
        {
          id: crypto.randomUUID(),
          file: fileToKeep,
          title: fileToKeep.name.replace(/\.[^/.]+$/, '').slice(0, 255),
          description: 'Minh chứng tệp đính kèm',
        },
      ]);
    }
    setAiNotice({
      type: 'info',
      message: 'Dịch vụ AI Vision tạm thời gián đoạn. Tệp đã được lưu vào minh chứng, vui lòng tự nhập các thông tin để tiếp tục.',
    });
  } finally {
    setAiScanning(false);
    setAiFile(null);
    setAiPreview(null);
  }
};
```

### 5.3 Step 3: Update `frontend/src/components/PortfolioAchievements.jsx`
Update status mapping dictionaries:
```javascript
const statuses = {
  ACTIVE: 'Sẵn sàng sử dụng',
  DRAFT: 'Bản nháp',
  UNDER_REVIEW: 'Đang xét duyệt',
  SUBMITTED: 'Chờ duyệt',
  NEED_CORRECTION: 'Cần bổ sung',
  VERIFIED: 'Đã xác nhận',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
  REVOKED: 'Đã thu hồi',
};

const statusStyles = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  SUBMITTED: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  NEED_CORRECTION: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  VERIFIED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  REVOKED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
```

---

## 6. Verification and Validation Checklist

| Check # | Requirement / Criterion | Verification Method |
|---|---|---|
| V1 | Status `ACTIVE` shows "Sẵn sàng sử dụng" in green badge | Inspect rendered badge text & classes in `Achievements.jsx` and `PortfolioAchievements.jsx` |
| V2 | Standard 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) can create achievements | Verify `canCreate` logic allows all authenticated members |
| V3 | `achievementsApi.aiExtract` transmits multipart/form-data with file | Unit test or mock call verifying formData construction |
| V4 | AI Vision auto-populates title, year, issue date, issuer, decision number, and matches category | Simulated response test verifying `formData` and `pendingEvidences` population |
| V5 | Graceful fallback on `fallback: true` or 503/error does not crash, shows gentle message, and opens manual form | Verify fallback branches set `aiNotice` and preserve uploaded file in `pendingEvidences` |
| V6 | Vite production build succeeds without errors or regressions | `npm --prefix frontend run build` completes with exit code 0 |
| V7 | All E2E achievement tests pass | `node tests/e2e/runner.js` passes Tier 1 Feature 1, 2, 3 tests |
