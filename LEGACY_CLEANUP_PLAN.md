# Kiểm kê legacy và kế hoạch dọn dẹp

## Kết luận và phạm vi

Backend V2 vẫn tải **7 file** trong `backend/src/modules`, gồm hai file health và năm file hỗ trợ AI. Frontend có đường đi từ entry point đến mọi file JS, JSX và CSS trong `frontend/src`. Ứng viên dọn ở frontend là cấu hình fixture cũ và dependency chỉ còn phục vụ test legacy.

Kiểm kê dựa trên rà soát tĩnh từ các entry point, router Express, chuỗi migration, import trực tiếp và bắc cầu, script npm, CI và tham chiếu đường dẫn trong script. Chưa chạy migration, test hoặc kết nối dịch vụ. Tài liệu này là kế hoạch, chưa thực hiện di dời hay xóa.

## 1. Kiểm kê tài nguyên

### Backend

Các đường dẫn module trong bảng tính từ `backend/src/modules/`. Một thư mục được nêu trong bảng bao gồm toàn bộ file bên trong, trừ các ngoại lệ ghi rõ.

| Tài nguyên | Hiện trạng |
| --- | --- |
| `achievements/` | `achievementAiIngestService.js` thuộc luồng cũ. V2 dùng `vaultRoutes.js` và `vision.js`. |
| `admin/`, `auth/`, `profiles/`, `organizations/` | Router, controller, service, repository và schema cũ nằm ngoài đồ thị runtime. V2 dùng `identityRoutes.js` và `access.js`. |
| `calendar/`, `notifications/`, `reports/`, `selections/` | Module cũ nằm ngoài runtime. V2 có lịch, thông báo, tổng quan và lựa chọn cơ bản trong `supportRoutes.js`. Báo cáo CSV và lựa chọn hồ sơ giải thưởng thuộc hợp đồng cũ. |
| `regulations/` | Module cũ nằm ngoài runtime. V2 dùng `intelligenceRoutes.js`, `regulationDistributionRoutes.js`, `regulationSourceRoutes.js` và `regulationAccess.js`. |
| `cv/` | `cvRoutes.js`, `cvSchemas.js`, `cvService.js`, `cvRepository.js`, `templates/default_cv.docx`. V2 dùng `vaultRoutes.js` và `supportRoutes.js`, có trình dựng DOCX riêng qua `pizzip`. |
| `evidences/` | `evidenceRoutes.js`, `evidenceController.js`, `evidenceRepository.js`, `evidenceService.js`, `evidenceValidators.js`, `storage/localStorageAdapter.js`. Adapter còn được script demo và kiểm chứng dữ liệu cũ dùng. |
| `kpi/` | `kpiRoutes.js`, `kpiSchemas.js`, `kpiService.js`, `kpiRepository.js`, `recommendationService.js`, `externalConnector.js`, `externalContract.js`, `externalService.js`. V2 xử lý KPI qua `intelligenceRoutes.js`. Còn người gọi ngoài runtime cho `externalContract.js` và `kpiSchemas.js`. |
| `audit/auditService.js` | Service audit cũ. Handler V2 có logic ghi `app.audit_events` riêng. |
| `ai/` | Ứng viên dọn gồm `aiRoutes.js`, `aiController.js`, `aiService.js`, `aiCache.js`, `autoDiscoveryService.js`, `criteriaEvaluator.js`, `evaluationRepository.js`, `evaluationSchemas.js`, `dossierPackagerService.js`, toàn bộ `rag/` và `providers/mockProvider.js`. Giữ hoặc di dời năm file AI ở mục 2. |
| `health/` | Cả `healthRoutes.js` và `healthController.js` đang chạy. Giữ hoặc di dời cùng nhau. |
| `backend/src/mock/kpiServer.js` | Mock KPI ngoài cũ, vẫn được `scripts/verify-scenario.mjs` import động. |
| `backend/src/middlewares/` | Ứng viên dọn gồm `authenticate.js`, `requireLecturerRead.js`, `requireRoles.js`, `requireScope.js`, `requireUnitRead.js`. Giữ `correlationId.js`, `errorHandler.js`, `notFoundHandler.js`. |

### Frontend và cấu hình

| Tài nguyên | Hiện trạng |
| --- | --- |
| `frontend/src/{pages,components,layouts,context,hooks,services}/` | Không tìm thấy page/component JS, JSX hoặc CSS mồ côi từ `main.jsx`. Đồ thị bao gồm route, layout, component con và re-export. Ví dụ `RegulationLibrary.jsx` được nối qua export `Regulations` của `V2.jsx`. `services/.gitkeep` là placeholder. |
| `frontend/.env.fixture` | `VITE_DATA_SOURCE=fixture` không có chỗ đọc trong `frontend/src`. Có thể dọn file này và dòng/chú thích tương ứng trong `frontend/.env.example` và hướng dẫn triển khai. Script UI lịch sử còn truyền biến khi dựng Vite. Giữ `VITE_API_URL` và tiền tố mặc định `/api/v1`. |
| `exceljs` trong `frontend/package.json` | Không có import trong `frontend/src`. `backend/tests/ui-feedback.test.js` import trực tiếp từ `frontend/node_modules/exceljs`. Dọn dependency sau khi xử lý test. |
| `AI_MAX_RETRIES`, `AI_CACHE_ENABLED` | Được AI service/cache cũ đọc. Có thể dọn khỏi `backend/src/config/env.js` và `.env.example` sau khi ngừng stack cũ. Adapter đang chạy vẫn cần cấu hình provider, model, pool và timeout tương ứng. |
| `AI_PROVIDER=mock`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `UPLOAD_DIR` | Rà theo từng biến. V2 lưu hash của refresh token ngẫu nhiên trong SQL và dùng `STORAGE_DIR` cho kho file. Schema vẫn chấp nhận `AI_PROVIDER=mock`, nhưng luồng đề xuất quy chế V2 không khởi tạo mock provider từ giá trị này. CI vẫn khai báo `JWT_REFRESH_SECRET`. |
| `docxtemplater`, `pg` | `docxtemplater` thuộc bộ xuất CV cũ. `pg` còn phục vụ `scripts/migrate-postgres-to-sqlserver.mjs`. Chốt việc giữ công cụ chuyển đổi trước khi bỏ dependency và cập nhật lockfile. |
| `backend/.env`, `backend/.env.demo` | Cấu hình local/demo cần xét theo người sử dụng. Kiểm kê không đọc hoặc in giá trị từ những file này. |

### Database, công cụ và hợp đồng API

| Tài nguyên | Phân loại |
| --- | --- |
| `database/migrations/` | Toàn bộ chuỗi PostgreSQL cũ `001`–`009` và placeholder. Lưu trữ nếu cần tái lập DB lịch sử. |
| `supabase/` | Toàn bộ `migrations/`, `tests/w1_p2_profiles_catalogs_test.sql`, `tests/w1_p3_organization_history_test.sql` và `config.toml`. `scripts/validate_contracts.mjs` còn đọc migration và test ở đây. |
| `database/sqlserver/migrations/` | Chuỗi SQL Server cũ từ `001_final_schema.sql` đến `005_refactor_personal_vault_and_cv.sql`. Cùng cụm với `build-baseline.mjs`, `schema-manifest.json`, `schema.test.mjs`, `verify-live.mjs`, `verify-refactor.mjs` và `challenger2-stress.mjs`. |
| `database/scripts/` | `test-w1-p2.js`, `test-w1-p3.js`, `seedScenario.js`, `prepareUiTestAccounts.js` thuộc nhóm công cụ cũ. `seed.js` vẫn có người gọi từ test CI để kiểm cơ chế chặn seed legacy. `migrate.js` là runner V2 hiện hành. |
| Công cụ chuyển đổi và kiểm chứng | `scripts/migrate-postgres-to-sqlserver.mjs`, `verify-sqlserver-transfer.mjs`, `verify-scenario.mjs`, `verify-selections.mjs`, `pre-demo-check.mjs`. Xét nhu cầu tra cứu hoặc chuyển dữ liệu lịch sử trước khi lưu trữ hay dọn. |
| Demo và test kit | `scripts/demo/start-demo.mjs`, `verify-rich-demo.mjs`, `align-rich-history.mjs` bám luồng cũ. `scripts/validate-ui-test-kits.mjs` dùng parser KPI cũ. `scripts/page-loading-ui.mjs`, `admin-management-ui.mjs`, `cv-ui-test.mjs`, `ai-workflow-ui.mjs` chứa API, payload hoặc giả lập của hợp đồng cũ. Ví dụ test CV mock `publish`, `unpublish` và `rotate-link`, trong khi V2 lưu CV qua `PUT /me/cv`. |
| `docs/api/` | `openapi.json`, `openapi.yaml`, toàn bộ `W*.openapi.json`, `fixtures/` và `templates/W3_P2_kpi.csv` là hợp đồng lịch sử. OpenAPI tổng còn mô tả `/lecturers`, `/award-records` và `/reports/export.csv`. Giữ `V2.md`. |
| Bộ sinh và kiểm OpenAPI cũ | `scripts/generate_yaml.mjs`, `validate_contracts.mjs`, `update-w2-p1-contract.mjs`, `update-w2-p2-contract.mjs`, `update-w3-p1-contract.mjs`, `update-w3-p2-contract.mjs`, `update-w3-p3-contract.mjs`. Xử lý cùng tài liệu nguồn. |
| Hồ sơ dự án và dữ liệu vận hành | `Page_Design/`, báo cáo, ảnh và kết quả kiểm thử theo tuần là tài sản lưu trữ. Kho file, backup, tài liệu nguồn quy chế và dữ liệu hiện hữu cần chính sách lưu giữ riêng. |

### Test

| Nhóm | Kiểm kê và xử lý |
| --- | --- |
| Bộ tuần và đối kháng cũ | `backend/tests/w[1-6]-*`, `challenger-*.test.js`, `tier5-backend-adversarial.test.js`, `backend/tests/runner.js`, `backend/tests/fixtures/legacy/`. Đưa các ca gắn schema, role hoặc endpoint cũ ra khỏi bộ V2. Các ca kiểm hồ sơ bàn giao có thể lưu cùng hồ sơ dự án. |
| Test backend theo chức năng cũ | `achievement-trash.integration.js`, `achievement-vault-active.test.js`, `admin-permissions.test.js`, `adversarial-ai-evaluator.test.js`, `adversarial-vault-permissions.test.js`, `ai-auto-discovery.test.js`, `ai-criteria-active.test.js`, `audit.test.js`, `calendar.test.js`, `calendar-reminder.test.js`, `calendar.integration.js`, `criteria-source-rules.*`, `cv.test.js`, `cv-slug-docx.test.js`, `deep-review-fixes.test.js`, `dossier-packager-zip.test.js`, `kpi-from-gap.test.js`, `page-loading.test.js`, `password-reset.test.js`, `registration.integration.js`, `ui-feedback.test.js`, `unit-ai-scan.test.js`, `unit-profile-access.test.js`. Chuyển các hành vi còn giá trị sang ca V2 nếu chưa được bao phủ. |
| SQL Server và E2E cũ | `backend/tests/sqlserver-core.integration.js`, `sqlserver-m3.integration.js`, `sqlserver-ai-kpi.integration.js`, toàn bộ `tests/e2e/`, `tests/achievements_mount_verification.test.mjs`, `tests/empirical_challenge_m1.test.mjs`, `tests/empirical_challenge_m4_adversarial.test.mjs`. Lệnh npm gốc `test:e2e` và `test:e2e:smoke` đã gọi `backend test:api`. `TEST_READY.md` và `TEST_INFRA.md` còn mô tả harness cũ. |
| Test có dependency hỗn hợp | `backend/tests/ai-pool.test.js` import cả `AiService`/cache cũ và `PoolProvider` đang dùng. Tách phần kiểm adapter trước khi dọn. `database/sqlserver/runner.test.mjs` kiểm V2 và có ca bảo vệ khỏi seed cũ. |
| Test và công cụ V2 cần giữ | Các test theo manifest backend và CI, `frontend/tests/`, `database/sqlserver/v2/schema.integration.test.mjs`, `backend/tests/regulationSources.test.js`, `sourceTranscription.integration.js`, `scripts/v2-browser-fixture.mjs`. `scripts/storageBackup.test.mjs` và `backend/tests/sqlserver-backup.integration.js` thuộc nghiệp vụ backup/restore, xét riêng với bộ SQL Server cũ. |

## 2. Phụ thuộc chéo

### Runtime và kiểm thử V2

| File gọi | File được gọi | Vai trò |
| --- | --- | --- |
| `backend/src/app.js` | `backend/src/modules/health/healthRoutes.js` | Mount liveness và readiness. |
| `backend/src/modules/health/healthRoutes.js` | `backend/src/modules/health/healthController.js` | Controller dùng `config/database.js` và `config/env.js`. |
| `backend/src/v2/regulationSources.js` | `backend/src/modules/ai/providers/{groqProvider,openrouterProvider,poolProvider}.js` | Ba adapter để đề xuất tiêu chí từ văn bản nguồn. Import tĩnh làm cả ba trở thành phụ thuộc lúc khởi động, kể cả khi cấu hình chỉ chọn một provider. |
| Ba adapter trên | `backend/src/modules/ai/aiProviderInterface.js` và `aiErrors.js` | Interface, kiểm tra model và lỗi provider. Interface cũng import `aiErrors.js`. Adapter dùng `config/env.js` và đến `utils/errors.js` trực tiếp hoặc qua `aiErrors.js`. |
| `backend/src/v2/regulationSourceRoutes.js` và `backend/src/v2/vision.js` | `backend/src/v2/regulationSources.js` | Hai đường đến module import adapter. Vision gọi `extractSourceText` và có logic provider riêng. |
| `backend/src/app.js` | `backend/src/middlewares/{correlationId,errorHandler,notFoundHandler}.js` | Middleware hiện hành. Xác thực V2 dùng `backend/src/v2/access.js`. |
| `database/sqlserver/v2/verify.mjs` | `database/scripts/migrate.js`, `backend/src/config/database.js` | Kiểm schema và lịch sử migration V2. Runner chỉ đọc `database/sqlserver/v2/migrations/`. |
| `database/sqlserver/v2/schema.integration.test.mjs` | `backend/src/config/database.js` | Kiểm schema trên SQL Server qua adapter hiện tại. |
| `database/sqlserver/runner.test.mjs` | `database/scripts/migrate.js` và `database/scripts/seed.js` | Import `seedDatabase` để kiểm việc từ chối seed legacy. |
| `frontend/src/pages/V2.jsx` và cây import từ `frontend/src/main.jsx` | Helper, service, context, component và page trong `frontend/src` | Không thấy import sang backend legacy, Supabase, fixture OpenAPI hoặc migration cũ. |

Nguồn đối chiếu [app.js](backend/src/app.js#L16), [regulationSources.js](backend/src/v2/regulationSources.js#L10), [migrate.js](database/scripts/migrate.js#L8), [runner.test.mjs](database/sqlserver/runner.test.mjs#L5).

### Người gọi ngoài runtime

| Người gọi | Phụ thuộc |
| --- | --- |
| `scripts/demo/start-demo.mjs` | Import động `backend/src/modules/kpi/externalContract.js` để lấy `simulationRecord`. |
| `scripts/pre-demo-check.mjs`, `scripts/demo/verify-rich-demo.mjs`, `scripts/verify-scenario.mjs` | Dùng `backend/src/modules/evidences/storage/localStorageAdapter.js`. `verify-scenario.mjs` còn import động `backend/src/mock/kpiServer.js`. Script kiểm file còn truy vấn metadata theo schema cũ. |
| `scripts/validate-ui-test-kits.mjs` | Import `readCsv` từ `backend/src/modules/kpi/kpiSchemas.js`. |
| `scripts/w5-p2-eval.mjs` | Import evaluator cũ `ai/criteriaEvaluator.js` và `kpi/recommendationService.js`. |
| `scripts/w5-q2-eval.mjs` | Import evaluator cũ `ai/criteriaEvaluator.js`, `ai/rag/ragExplanationService.js` và `ai/rag/ragRetrievalService.js`. |
| `scripts/validate_contracts.mjs` và bộ `update-*` / `generate_yaml.mjs` | Tham chiếu đường dẫn file đến OpenAPI, fixture, Supabase và repository cũ. Các tham chiếu này nằm ngoài cây import. |
| `scripts/backup.mjs`, `scripts/restore.mjs` | Dùng `storageRoot` từ `backend/src/v2/files.js` và còn hỗ trợ kiểm tra archive lịch sử theo thiết kế. Backup mới yêu cầu schema V2. |
| `cloudflare/ai-pool/` | Worker và dashboard vận hành độc lập. `PoolProvider` gọi Worker qua `AI_POOL_URL` khi cấu hình. |

Giữ `scripts/seed-lecturer-demo.mjs`, `scripts/seed-regulation-awards.mjs` và `scripts/provision-admin.mjs` trong phạm vi V2. Chúng dùng helper, evaluator hoặc các bảng hiện hành của V2.

## 3. Kế hoạch di dời

1. **Chuyển cụm AI đang dùng.** Đưa ba adapter vào `backend/src/integrations/ai/providers/`. Đặt `aiProviderInterface.js` và `aiErrors.js` trong `backend/src/integrations/ai/`. Sửa import của `regulationSources.js`, các adapter và test được giữ. Giữ hợp đồng provider, model, timeout và lỗi.
2. **Giữ health và runner.** Nếu bỏ cả thư mục `modules`, chuyển cặp health sang `backend/src/health/` và sửa import trong `app.js`. Giữ ba middleware hiện hành và `database/scripts/migrate.js`. Giữ stub `seed.js` nếu cần hành vi chặn lệnh cũ, hoặc dọn stub cùng ca kiểm sau khi chốt hợp đồng CLI.
3. **Xử lý người gọi ngoài runtime.** Lưu nguyên cụm script, test và migration lịch sử nếu cần tái lập. Nếu chuyển công cụ kiểm file sang V2, dùng storage helper và metadata V2. Chỉ đổi import adapter sẽ vẫn để lại truy vấn cũ như `award_decision_files`.
4. **Đồng bộ hợp đồng và cấu hình.** Chuyển OpenAPI, fixture và công cụ tương ứng cùng nhau. Cập nhật tài liệu, `.env.example`, CI, manifest và lockfile sau khi xử lý người gọi cuối. Giữ `/api/v1` vì đây là tiền tố HTTP mặc định của V2.
5. **Xác minh rồi mới dọn.** Quét lại import tĩnh, import động, đọc file theo đường dẫn và lệnh npm/CI. Chạy frontend lint/build/test, backend unit và suite V2 trên SQL Server kiểm thử. Kiểm riêng health/readiness, đề xuất tiêu chí qua adapter, `migrate:status` và kiểm archive cũ nếu vẫn cần hỗ trợ restore.
