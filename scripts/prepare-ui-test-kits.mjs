/** Build self-contained UI test packs. No database access and no application test execution. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'output/ui-test-kits');
const fixtures = path.join(root, 'docs/testing/kits/fixtures');
const runDate = '2026-10-19';
const addDays = amount => { const d = new Date(`${runDate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); };
const headers = ['code','title','measureUnit','periodStart','periodEnd','target','plan','sourceNote','actual','evidenceNote'];
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = rows => '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
const table = rows => rows.map(row => `| ${row.map(cell => String(cell).replaceAll('|','/').replaceAll('\n',' / ')).join(' | ')} |`).join('\n');
const baseline = 'SCN-A01 nháp thiếu file; A02 chờ duyệt; A03 cần bổ sung; A04 xác nhận; A05 từ chối; A06 hủy; A07 thu hồi; A08 nháp thay A07; A09 của Bích; A10 của Linh; T01 nháp tập thể; T02 tập thể đã xác nhận. P01…P07 và PT01 là đề nghị nhiều trạng thái. R01 thiếu file, R02 ghi nhận, R03 thu hồi, RT01 tập thể. K01/K02/K03/KT01 là KPI seed.';

function definitions(t) {
  const p = `UI-T${t}-R01-`;
  const achievement = (code, label, type = 'Bài báo quốc tế ISI/Scopus Q1') => ({
    'Tên thành tích': p + code + ' | ' + label + ' [MÔ PHỎNG]',
    'Chủ thể': 'Cá nhân / Nguyễn Văn An', 'Loại thành tích': type,
    'Mô tả': 'Dữ liệu thử nghiệm giao diện. Chỉ dùng kiểm luồng kê khai, minh chứng và xét duyệt; không xác nhận thành tích thực tế.',
    'Vai trò đóng góp': 'Tác giả chính', 'Ngày bắt đầu': addDays(-20), 'Ngày kết thúc': addDays(-5),
    'Năm ghi nhận': '2026', 'Năm học': '2026-2027', 'File chọn': 'uploads/valid/evidence-v1.pdf',
  });
  const proposal = (code, collective = false) => ({
    'Chủ thể': collective ? 'Tập thể / Bộ môn Kỹ thuật Phần mềm' : 'Cá nhân / Nguyễn Văn An',
    'Kỳ xét': 'SCN | Kỳ xét thưởng đang mở - MÔ PHỎNG (SCN-OPEN-2026)',
    'Loại khen thưởng': collective ? 'Tập thể Lao động xuất sắc' : 'Chiến sĩ thi đua cơ sở',
    'Thành tích chọn': collective ? 'SCN-T02' : 'SCN-A04',
    'Mục đích đề nghị': p + code + ' | Đề nghị xét khen thưởng MÔ PHỎNG để kiểm thử UI.',
    'Lưu ý': 'Chọn hồ sơ bằng tên; chỉ dùng nguồn đã xác nhận của đúng chủ thể.',
  });
  const decision = code => ({
    'Số quyết định': p + code + '-2026', 'Ngày quyết định': runDate,
    'Cơ quan ban hành': 'Đơn vị mô phỏng PTUD', 'Tên quyết định': p + code + ' | Quyết định thử nghiệm, không có giá trị thực tế',
    'Chủ thể ghi sổ': 'Cá nhân / Nguyễn Văn An', 'Loại khen thưởng': 'Chiến sĩ thi đua cơ sở',
    'Năm ghi nhận': '2026', 'Nguồn chọn': 'SCN-A04 (hoặc thành tích riêng đã xác nhận của ca)',
    'File quyết định': 'uploads/valid/decision-demo.pdf',
  });
  const result = {
    'evidence': { title: 'Thông tin khi thêm minh chứng / phiên bản', fields: { 'Tên minh chứng ban đầu': p + 'EVIDENCE | Minh chứng mô phỏng V1', 'Mô tả': 'Tệp mô phỏng dùng kiểm upload, tải về và lịch sử phiên bản.', 'File ban đầu': 'uploads/valid/evidence-v1.pdf', 'Ghi chú phiên bản mới': 'V2: bổ sung nội dung để đối chiếu; khác nội dung và SHA của V1.', 'File phiên bản mới': 'uploads/valid/evidence-v2.pdf' } },
    'auth': { title: 'Đăng nhập và chuyển vai trò', fields: { 'Mật khẩu 10 tài khoản SCN': 'demo1234', 'Tài khoản dùng': 'an.nv / bich.tt / duc.pm / cuong.lh / records.demo / council.demo / council.other / linh.pharm / rep.expired / locked.demo', 'Mật khẩu sai để thử': 'Wrong@2026', 'Tài khoản không tồn tại': `not.exists.t${t}`, 'Lưu ý': 'locked.demo cố ý bị khóa; rep.expired có role nhưng phân công đã hết hạn. Chuyển role bằng đăng xuất hoặc profile trình duyệt riêng.' } },
    'achievement': { title: 'Nháp thành tích dùng riêng', fields: achievement('ACH-01','Hồ sơ thử nghiệm cá nhân') },
    'reasons': { title: 'Ý kiến và lý do mẫu', fields: { 'Yêu cầu bổ sung': 'Bổ sung vai trò đóng góp và tải lại minh chứng có nội dung phiên bản V2 để đối chiếu.', 'Nội dung bổ sung': 'Đã bổ sung vai trò tác giả chính, tổng hợp dữ liệu và kiểm tra kết quả. Minh chứng V2 được đính kèm.', 'Xác nhận thành tích': 'Đã kiểm tra nội dung và minh chứng của hồ sơ mô phỏng, thông tin khớp với dữ liệu thử nghiệm.', 'Từ chối': 'Minh chứng thử nghiệm không khớp nội dung kê khai trong ca kiểm nhánh từ chối.', 'Rút/hủy': 'Chủ hồ sơ rút kê khai để kiểm tra lịch sử và trạng thái hủy.', 'Thu hồi': 'Phát hiện sai nội dung trong hồ sơ mô phỏng; thu hồi để kiểm tra báo cáo và bản thay thế.', 'Chuyển Hội đồng': 'Đơn vị đã đối chiếu thành tích nguồn và minh chứng. Chuyển Hội đồng rà soát hồ sơ mô phỏng.', 'Phân công': 'Phân công council.demo xử lý hồ sơ mô phỏng trong phạm vi CNTT.', 'Ghi ý kiến Hội đồng': 'Hồ sơ mô phỏng có nguồn và minh chứng đọc được; cần đối chiếu tiêu chí áp dụng trước kết luận.', 'Đề nghị': 'Đề nghị xử lý khen thưởng trong kịch bản thử nghiệm; chưa phải quyết định trao thưởng.', 'Không đề nghị': 'Chưa đáp ứng yêu cầu của nhánh kiểm thử; lưu lý do không đề nghị.', 'File bổ sung': 'uploads/valid/evidence-v2.pdf' } },
    'proposal': { title: 'Đề nghị cá nhân mới', fields: proposal('APP-NEW') },
    'collective': { title: 'Đề nghị / thành tích tập thể', fields: { ...proposal('APP-UNIT', true), 'Tài khoản kê khai': 'cuong.lh', 'Tên thành tích nếu cần tự tạo': p + 'UNIT-ACH | Sáng chế tập thể mô phỏng', 'Loại thành tích': 'Bằng độc quyền sáng chế', 'Lưu ý phạm vi': 'Cường đại diện KTPM, không phải KHMT hoặc toàn Khoa CNTT.' } },
    'decision': { title: 'Quyết định và sổ riêng', fields: decision('AWD-NEW') },
    'profile': { title: 'Thông tin hồ sơ mẫu', fields: { 'Số điện thoại': '0900000001', 'Chức danh': 'Giảng viên thử nghiệm', 'Học vị': 'Thạc sĩ', 'Lưu ý': 'Thông tin giả lập để kiểm lưu; không đổi đơn vị hoặc quyền ở form hồ sơ.' } },
  };
  if (t === 1) {
    result.main = { title: 'Luồng MAIN - A01 đến sổ thưởng', fields: { ...proposal('MAIN'), 'Thành tích chọn': 'SCN-A01 sau khi chính người 1 xác nhận qua FLOW-01…05', 'Mục đích đề nghị': p + 'MAIN | Đề nghị cá nhân MÔ PHỎNG', 'Số quyết định': p + 'MAIN-2026', 'Ngày quyết định': runDate, 'Cơ quan ban hành': 'Đơn vị mô phỏng PTUD', 'File lần đầu': 'uploads/valid/evidence-v1.pdf', 'File bổ sung': 'uploads/valid/evidence-v2.pdf', 'File quyết định': 'uploads/valid/decision-demo.pdf', 'Người xét chọn': 'council.demo' } };
    result.revocation = { title: 'Sổ riêng để thu hồi, không dùng MAIN', fields: decision('AWD-REVOKE') };
    for (let i = 1; i <= 5; i++) result[`portfolio-paper-${i}`] = { title: `Nháp phân trang ${i}/5`, fields: achievement(`PORT-PAPER-0${i}`, `Bài báo phân trang số ${i}`) };
    result['portfolio-patent'] = { title: 'Phân nhóm nghiên cứu - sáng chế', fields: achievement('PORT-PATENT','Sáng chế dùng kiểm phân nhóm','Bằng độc quyền sáng chế') };
    result['portfolio-teaching'] = { title: 'Phân nhóm giảng dạy - giáo trình', fields: achievement('PORT-TEACHING','Giáo trình dùng kiểm phân nhóm','Giáo trình được nghiệm thu') };
    result['portfolio-upload'] = { title: 'Nháp riêng thử đóng form / file lỗi', fields: achievement('PORT-UPLOAD','Hồ sơ riêng kiểm popup upload') };
    for (const [key,label,type,day,start,end] of [
      ['calendar-exam','Lịch thi thử','Lịch thi',addDays(1),'08:00','10:00'],
      ['calendar-competition','Cuộc thi nghiên cứu thử','Cuộc thi',addDays(2),'09:00','11:00'],
      ['calendar-task','Hoàn thiện hồ sơ thử','Công việc',addDays(3),'13:30','15:00'],
      ['calendar-personal','Ghi chú cá nhân thử','Cá nhân',addDays(1),'17:00','17:30'],
      ['calendar-overdue','Việc quá hạn mô phỏng','Công việc',addDays(-2),'08:00','09:00'],
    ]) result[key] = { title: label, fields: { 'Tiêu đề': p + label, 'Loại': type, 'Bắt đầu': `${day}T${start}`, 'Kết thúc': `${day}T${end}`, 'Cả ngày': 'Không', 'Địa điểm / đường dẫn': 'Phòng thực hành mô phỏng', 'Ghi chú': 'Ghi chú kiểm thử có tiếng Việt.\nDòng thứ hai để kiểm xuống dòng.', 'Hoàn thành': 'Chưa' } };
    result['calendar-multiday'] = { title: 'Lịch cả ngày qua tháng', fields: { 'Tiêu đề': p + 'CAL-MULTIDAY', 'Loại': 'Cá nhân', 'Cả ngày': 'Có', 'Bắt đầu': '2026-10-31', 'Kết thúc': '2026-11-02', 'Ghi chú': 'Phải hiển thị đủ ngày 31/10, 01/11 và 02/11.' } };
    result['calendar-invalid'] = { title: 'Lịch sai để kiểm chặn', fields: { 'Tiêu đề': p + 'CAL-BAD', 'Bắt đầu': `${addDays(1)}T10:00`, 'Kết thúc': `${addDays(1)}T09:00`, 'Mong đợi': 'Bị chặn; không tạo bản ghi.' } };
  } else {
    result.password = { title: 'Tài khoản chuyên dùng đổi mật khẩu', fields: { 'Tài khoản': 'ui.t2.password', 'Mật khẩu hiện tại sau seed bổ sung': 'demo1234', 'Mật khẩu mới hợp lệ': 'UiT2@Change2026', 'Mật khẩu xác nhận sai': 'UiT2@Mismatch2026', 'Mật khẩu mới quá ngắn': 'abc', 'Khôi phục sau ca nếu cần': 'Đổi lại demo1234 qua UI bằng mật khẩu hiện tại mới; không đổi mật khẩu tài khoản An/Bích.', 'Lưu ý chuẩn bị': 'Người phụ trách chạy prepareUiTestAccounts.js --tester=2 --apply trên ENV-T2 trước buổi test. Tài khoản có role, hồ sơ giảng viên, phân công KTPM.' } };
    result['keyboard-calendar'] = { title: 'Lịch riêng để kiểm bàn phím UX-03', fields: { 'Tiêu đề': p+'UX-KEYBOARD', 'Loại': 'Công việc', 'Bắt đầu': addDays(1)+'T08:00', 'Kết thúc': addDays(1)+'T09:00', 'Ghi chú': 'Lịch giả lập cho kiểm Tab/Shift+Tab/Enter/Space/Esc.' } };
    result['report-revoke'] = { title: 'Sổ riêng để đối chiếu báo cáo trước/sau thu hồi', fields: decision('REPORT-REVOKE') };
    result.double = { title: 'Chuẩn bị chống bấm lặp', fields: { ...achievement('DOUBLE-ACH','Hồ sơ kiểm bấm lặp'), 'Số quyết định sổ dùng bấm lặp': p + 'DOUBLE-AWD-2026', 'Thứ tự chuẩn bị': 'An tạo nháp và thêm file → thử bấm đôi Lưu/Gửi; Văn thư tự tạo quyết định và sổ nháp có file → thử bấm đôi Ghi nhận.', 'File quyết định': 'uploads/valid/decision-demo.pdf' } };
    result.consistency = { title: 'Chuẩn bị đối chiếu nhiều màn hình', fields: { ...achievement('CONSISTENCY','Hồ sơ kiểm tính nhất quán'), 'Mục đích đề nghị': p + 'CONSISTENCY | Đề nghị đối chiếu nhiều màn hình', 'Thứ tự tự làm': 'An lưu/thêm file/gửi → Bích xác nhận → An tạo/nộp đề nghị → Bích chuyển Hội đồng → council.demo đọc. Tất cả trong ENV-T2.' } };
    result.kpi = { title: 'KPI nhập bằng form', fields: { 'Mã KPI': p + 'KPI-FORM-01', 'Tên mục tiêu': p + 'KPI-FORM-01 | Hoàn thiện bài báo thử', 'Đơn vị đo': 'bài', 'Bắt đầu kỳ': '2026-01-01', 'Kết thúc kỳ': '2026-12-31', 'Chỉ tiêu số lượng': '2', 'Kế hoạch thực hiện': 'Chuẩn bị bản thảo, thu thập tài liệu và đối soát hai hồ sơ giả lập.', 'Căn cứ / Nguồn cung cấp': 'DỮ LIỆU MÔ PHỎNG do người dùng nhập', 'Kết quả thực tế': '1', 'Căn cứ kết quả': 'Kết quả nhập tay cho kiểm thử UI', 'Ghi chú minh chứng kết quả': 'Có một bộ hồ sơ mô phỏng để kiểm chuyển từ KPI sang thành tích nháp.' } };
    result.regulation = { title: 'Văn bản, phiên bản và tiêu chí mô phỏng', fields: { 'Mã văn bản': p + 'REG-01', 'Tên văn bản': 'Quy định thử nghiệm UI - không phải chính sách LHU', 'Loại văn bản': 'Hướng dẫn / Mô phỏng', 'Cơ quan': 'Đơn vị mô phỏng PTUD', 'Mô tả': 'Văn bản giả lập để kiểm tạo phiên bản, trích đoạn và tiêu chí; không có giá trị pháp lý.', 'Phiên bản 1': 'v1', 'Ngày ký': runDate, 'Hiệu lực từ': runDate, 'Hiệu lực đến': '2026-12-31', 'Trạng thái nguồn': 'SIMULATION_ONLY / Mô phỏng', 'Nội dung băm phiên bản 1': 'UI-REG-V1. Bản mô phỏng dùng kiểm dữ liệu. Không phải quy định thật.', 'Phiên bản 2': 'v2', 'Hiệu lực từ của v2': '2027-01-01', 'Hiệu lực đến của v2': '2027-12-31', 'Nội dung băm phiên bản 2': 'UI-REG-V2. Bổ sung mô tả và thay đổi nội dung để kiểm hash khác v1.', 'Điều': 'Điều 1', 'Khoản': 'Khoản 1', 'Trang': '1', 'Nội dung trích đoạn': 'Đây là trích đoạn MÔ PHỎNG. Hai hồ sơ nghiên cứu giả lập chỉ phục vụ thao tác kiểm thử và không tạo căn cứ xét thưởng thật.', 'Mã tiêu chí': p + 'CRIT-01', 'Tên tiêu chí': 'Hai hồ sơ nghiên cứu mô phỏng cho test UI', 'Đối tượng': 'Cá nhân', 'Ngưỡng tối thiểu': '2', 'Đơn vị đo tiêu chí': 'hồ sơ', 'Tham chiếu': 'Điều 1, Khoản 1, Trang 1 của nguồn mô phỏng', 'Nhãn nguồn không được chọn giả': 'Không gắn CONFIRMED_LHU_POLICY cho tài liệu này.' } };
    result.ai = { title: 'AI: dữ liệu có thể dùng và điều kiện còn thiếu', fields: { 'Tài khoản': 'an.nv hoặc cuong.lh theo chủ thể', 'Tiêu chí có sẵn': 'SCN-CRIT-01', 'Tiêu chí không được coi hợp lệ': 'SCN-CRIT-DRAFT', 'Ngày đánh giá': runDate, 'Nguồn hiện tại': 'SIMULATION_ONLY', 'Kết quả mong đợi của demo': 'Đọc được lịch sử/thẩm định quy tắc; kết quả cần người có thẩm quyền rà soát.', 'RAG live': 'Chưa có nguồn quy chế chính thức được phê duyệt trong bộ này. Không tạo tài liệu giả để vượt gate; ghi Bị chặn nếu chưa được cung cấp nguồn hợp lệ.', 'Dữ liệu gửi provider': 'Chỉ gửi khi phạm vi gửi đã được xác nhận; không nhập API key/token vào form hay bug log.' } };
    result.external = { title: 'KPI nguồn mô phỏng', fields: { 'Mã nhân viên nguồn': 'SIM-EMP-001', 'Ánh xạ tới': 'Nguyễn Văn An / GV00234', 'Nguồn': 'KPI MÔ PHỎNG, không phải tích hợp dữ liệu thật', 'Điều kiện': 'Người phụ trách môi trường cấu hình mock source riêng cho ENV-T2 trước khi test; không copy một token thật vào tài liệu.' } };
    result.admin = { title: 'Tài khoản / role / phạm vi thử', fields: { 'Username mới': 'ui.t2.r01.user', 'Email': 'ui.t2.r01.user@example.invalid', 'Tên hiển thị': 'Người dùng thử nghiệm T2', 'Mật khẩu ban đầu': 'UiT2@Demo2026', 'Vai trò để kiểm quyền': 'Quản lý đơn vị (MANAGER)', 'Đơn vị phạm vi': 'Khoa Công nghệ Thông tin', 'Bao gồm đơn vị con': 'Có', 'Hiệu lực từ': '2026-10-19T08:00', 'Hiệu lực đến': '2027-10-19T23:59', 'Trạng thái thử khóa': 'LOCKED', 'Trạng thái khôi phục': 'ACTIVE' } };
    result.organization = { title: 'Đơn vị / đại diện / điều chuyển', fields: { 'Mã đơn vị mới': 'UI-T2-R01-UNIT', 'Tên đơn vị': 'Bộ môn thử nghiệm UI người 2', 'Loại': 'Bộ môn / DEPARTMENT', 'Đơn vị cha': 'Khoa Công nghệ Thông tin', 'Tài khoản đại diện tự tạo': 'ui.t2.r01.rep', 'Email đại diện': 'ui.t2.r01.rep@example.invalid', 'Tên hiển thị đại diện': 'Đại diện thử nghiệm T2', 'Mật khẩu đại diện': 'UiT2@Demo2026', 'Role gán trước': 'Đại diện đơn vị / UNIT_REPRESENTATIVE', 'Hạn đại diện': '2027-10-19', 'Giảng viên chỉ điều chuyển ở cuối lượt': 'Giảng viên Linh DEMO / linh.pharm', 'Lưu ý': 'Không điều chuyển An/Bích/Cường. Kiểm sai quyền và baseline báo cáo trước khi chuyển Linh.' } };
    result.catalog = { title: 'Danh mục và năm học dùng riêng', fields: { 'Mã loại thành tích': 'RESEARCH_UI_T2_R01', 'Tên loại thành tích': 'Nghiên cứu mô phỏng riêng T2', 'Đối tượng thành tích': 'LECTURER / Cá nhân', 'Mã loại thưởng': 'UI_T2_R01_AWARD', 'Tên loại thưởng': 'Danh hiệu mô phỏng T2', 'Nhóm loại thưởng': 'TITLE / Danh hiệu', 'Cấp thưởng': 'UNIVERSITY / Trường', 'Đối tượng thưởng': 'LECTURER / Cá nhân', 'Mã năm học': 'UI-T2-27', 'Tên năm học': 'Năm học mô phỏng 2027-2028', 'Ngày bắt đầu năm học': '2027-09-01', 'Ngày kết thúc năm học': '2028-08-31', 'Năm hiện tại khi tạo': 'Không; ca đổi năm hiện tại chạy cuối và khôi phục baseline 2026-2027.' } };
    result.long = { title: 'Nội dung dài có tiếng Việt để kiểm UX', fields: { 'Tiêu đề': p + 'UX-LONG | Nghiên cứu mô phỏng với nội dung tiếng Việt có dấu, dùng kiểm hiển thị trên màn hình điện thoại và khi phóng to giao diện', 'Mô tả nhiều dòng': 'Dòng 1: Tiếng Việt có dấu — Nguyễn, Trần, Đặng, nghiên cứu và giảng dạy.\nDòng 2: Chuỗi dài dùng kiểm xuống dòng, không được đè lên nút đóng hoặc nút lưu. '.repeat(8), 'Tên file dài': 'uploads/valid/minh-chung-ten-tep-rat-dai-co-tieng-viet-de-kiem-xuong-dong-tren-dien-thoai.pdf' } };
  }
  return result;
}

const groupResources = {
  AUTH: ['auth'], HOME: ['auth','profile'], FLOW: ['main','reasons'], APP: ['proposal','collective','reasons'], AWD: ['decision','revocation','reasons'], CAL: ['calendar-exam','calendar-competition','calendar-task','calendar-personal','calendar-overdue','calendar-multiday','calendar-invalid'], PORT: ['profile','portfolio-paper-1','portfolio-paper-2','portfolio-paper-3','portfolio-paper-4','portfolio-paper-5','portfolio-patent','portfolio-teaching'], NOTI: ['main','reasons'], ACH: ['achievement','collective','reasons'], REP: ['report-revoke'], KPI: ['kpi','external','ai'], REG: ['regulation'], AI: ['ai'], ORG: ['organization','admin'], ADM: ['admin','catalog','organization'], UX: ['long','achievement','double','consistency','decision'],
};

for (const t of [1,2]) {
  const out = path.join(outputRoot, `tester-${t}`);
  const write = (relative, content) => { const destination = path.join(out, relative); fs.mkdirSync(path.dirname(destination), { recursive:true }); fs.writeFileSync(destination, content); };
  const copy = (source, relative) => { const destination = path.join(out, relative); fs.mkdirSync(path.dirname(destination), { recursive:true }); fs.copyFileSync(source, destination); };
  const forms = definitions(t);
  for (const [id, form] of Object.entries(forms)) write(`copy/${id}.txt`, `${form.title}\n\n${Object.entries(form.fields).map(([key,value]) => `${key}:\n${value}\n`).join('\n')}`);
  write('copy/data.json', JSON.stringify({ tester:t, run:'R01', exampleDate:runDate, forms }, null,2));
  const sourcePlan = fs.readFileSync(path.join(root, `docs/testing/UI_TEST_PLAN_TESTER_${t}.md`),'utf8');
  const cases = sourcePlan.split(/\r?\n/).filter(line => /^\| [A-Z]+-\d+ \|/.test(line)).map(line => line.split('|').slice(1,-1).map(cell=>cell.trim()));
  assert.equal(cases.length, t===1 ? 72 : 73);
  write('01_TEST_PLAN.md', sourcePlan.replaceAll('(UI_TEST_PLAN_PARALLEL.md)','(README.md)').replaceAll('(UI_TEST_PLAN.md)','(README.md)').replaceAll('(kits/README.md)','(README.md)').replaceAll('evidence-demo.pdf','evidence-v1.pdf'));
  copy(path.join(root,'docs/testing/AI_INTEGRATION_CHECK_2026-10-19.md'),'reference/AI_INTEGRATION_CHECK_2026-10-19.md');
  for (const file of ['evidence-v1.pdf','evidence-v2.pdf','decision-demo.pdf','evidence-image.png','evidence-image.jpg']) copy(path.join(fixtures,file),`uploads/valid/${file}`);
  copy(path.join(fixtures,'evidence-v1.pdf'),'uploads/valid/minh-chung-ten-tep-rat-dai-co-tieng-viet-de-kiem-xuong-dong-tren-dien-thoai.pdf');
  write('uploads/invalid/empty.pdf', Buffer.alloc(0));
  write('uploads/invalid/not-supported.txt','Dữ liệu thử nghiệm TXT. Màn hình minh chứng phải từ chối loại tệp này.');
  write('uploads/invalid/fake-pdf.pdf','Đây chỉ là văn bản UTF-8 được đặt đuôi PDF. Không phải PDF thật.');
  const validPdf = fs.readFileSync(path.join(fixtures,'evidence-v1.pdf'));
  const oversized = Buffer.alloc(10*1024*1024+1, 32); validPdf.copy(oversized); write('uploads/invalid/over-10mb.pdf',oversized);
  if (t===2) {
    const validRows = kind => [
      [`UI-T2-R01-${kind}-01`,'Mục tiêu bài báo mô phỏng','bài','2026-01-01','2026-12-31',2,'Chuẩn bị hai bản thảo','DỮ LIỆU MÔ PHỎNG','',''],
      [`UI-T2-R01-${kind}-02`,'Mục tiêu giáo trình mô phỏng','quyển','2026-01-01','2026-12-31',1,'Hoàn thiện giáo trình','DỮ LIỆU MÔ PHỎNG','',''],
      [`UI-T2-R01-${kind}-03`,'Mục tiêu có kết quả mô phỏng','hồ sơ','2026-01-01','2026-12-31',2,'Chuẩn bị hồ sơ','DỮ LIỆU MÔ PHỎNG',1,'Một hồ sơ giả lập'],
    ];
    write('kpi/import-valid.csv',csv(validRows('CSV')));
    write('kpi/import-valid.tsv','\uFEFF'+[headers,...validRows('TSV')].map(row=>row.join('\t')).join('\r\n')+'\r\n');
    const invalidRows = validRows('BAD').slice(0,2); invalidRows[0][3]='2026-12-31'; invalidRows[0][4]='2026-01-01'; invalidRows[1][5]=-1;
    write('kpi/import-invalid.csv',csv(invalidRows));
    const missing = csv(validRows('MISSING')).replace('"sourceNote",',''); write('kpi/import-missing-column.csv',missing);
    const dup = validRows('DUP'); dup[1][0]=dup[0][0]; write('kpi/import-duplicate-code.csv',csv(dup));
    write('kpi/import-corrupt.xlsx','This is not a valid ZIP/XLSX workbook.');
    write('kpi/import-over-5mb.csv',Buffer.alloc(5*1024*1024+1,65));
    copy(path.join(fixtures,'kpi-valid.xlsx'),'kpi/import-valid.xlsx');
    copy(path.join(fixtures,'kpi-invalid.xlsx'),'kpi/import-invalid.xlsx');
    write('kpi/EXPECTED.md','# Kết quả mong đợi của file nhập KPI\n\n- import-valid.csv / .tsv / .xlsx: mỗi file 3 dòng hợp lệ, mã khác nhau giữa định dạng để có thể nhập cả ba trên cùng ENV-T2. Cột actual/evidenceNote giữ nguyên 10 cột.\n- import-invalid.csv / .xlsx: dòng 2 đảo ngày, dòng 3 có chỉ tiêu âm; preview phải báo lỗi.\n- import-missing-column.csv: cố ý thiếu header sourceNote, bị chặn đọc cấu trúc.\n- import-duplicate-code.csv: mã dòng 2 và 3 giống nhau; ghi đúng thông báo trùng thực tế, không mặc định tự gộp.\n- import-corrupt.xlsx: sai cấu trúc XLSX, phải báo lỗi đọc.\n- import-over-5mb.csv: lớn hơn 5 MB, phải bị chặn kích thước trước khi nhập.\n\nFile XLSX ở đây là đầu vào upload, không phải bản Excel của test plan. Không sửa tên header, thêm dòng tiêu đề hoặc thêm sheet giải thích vào file nhập.\n');
  }
  let dataMd = '# Dữ liệu mẫu để copy theo form\n\nNgày mẫu 19/10/2026. Nếu test ngày khác: đổi ngày quyết định và lịch thành ngày phù hợp; giữ thứ tự thời gian và nhãn mô phỏng. Kỳ SCN chọn theo ngày seed thực tế.\n\n';
  for (const [id,form] of Object.entries(forms)) dataMd += `## ${form.title}\n\n[File để copy](copy/${id}.txt)\n\n`+table([['Trường','Giá trị'],['---','---'],...Object.entries(form.fields)])+'\n\n';
  write('02_COPY_DATA.md',dataMd);
  let mapping = '# File và dữ liệu cho từng ca\n\nMỗi ID trong file chỉ thuộc người này. Seed là bản riêng của môi trường này.\n\n| ID | Ưu tiên | Mẫu copy | File upload | Dữ liệu seed / chuẩn bị |\n| --- | --- | --- | --- | --- |\n';
  for (const item of cases) {
    const [id,priority,,,steps] = item;
    const group = id.split('-')[0];
    let refs = (groupResources[group] || ['auth']).filter(key=>forms[key]);
    if (['FLOW','APP','AWD','PORT','ACH','REP','UX'].includes(group)) refs.push('evidence');
    if (id==='AUTH-07') refs=['password'];
    if (id==='PORT-06') refs=['portfolio-upload','evidence'];
    if (id==='UX-03') refs.push('keyboard-calendar');
    if (['REP-06','UX-07','UX-09'].includes(id)) refs=[{'REP-06':'report-revoke','UX-07':'double','UX-09':'consistency'}[id],'reasons'];
    const links = refs.map(key=>`[${key}](copy/${key}.txt)`).join(', ') || 'Dùng tên/mã trong bước test';
    let files = 'Không cần file mới';
    if (['FLOW','APP','AWD','PORT','ACH','REP','NOTI','UX'].includes(group)) files='[PDF v1](uploads/valid/evidence-v1.pdf), [PDF v2](uploads/valid/evidence-v2.pdf), [Quyết định](uploads/valid/decision-demo.pdf)';
    if (['ACH-05','AWD-03','PORT-06'].includes(id)) files='[TXT](uploads/invalid/not-supported.txt), [rỗng](uploads/invalid/empty.pdf), [giả PDF](uploads/invalid/fake-pdf.pdf), [quá 10MB](uploads/invalid/over-10mb.pdf)';
    if (id==='KPI-07') files='[CSV](kpi/import-valid.csv), [XLSX](kpi/import-valid.xlsx), [TSV](kpi/import-valid.tsv)';
    if (id==='KPI-08') files='[CSV lỗi](kpi/import-invalid.csv), [XLSX lỗi](kpi/import-invalid.xlsx), [thiếu cột](kpi/import-missing-column.csv), [mã trùng](kpi/import-duplicate-code.csv), [hỏng](kpi/import-corrupt.xlsx), [quá 5MB](kpi/import-over-5mb.csv)';
    mapping += table([[id,priority,links,files,item[3]]])+'\n';
  }
  write('03_FILES_BY_CASE.md',mapping);
  const stages = t===1 ? [
    ['01','AUTH/HOME','auth, profile','Kiểm phiên và điều hướng; không cần tạo hồ sơ trước.'],
    ['02','FLOW-01…15','main, reasons','Dùng SCN-A01. Tự đổi An → Bích → council.demo → records.demo → An/Bích. File v1 khi nộp, v2 khi bổ sung, decision-demo khi ghi nhận.'],
    ['03','APP/AWD','proposal, collective, decision, revocation, reasons','Dùng P01…P07/PT01 và R01…R03; không thu hồi quyết định MAIN.'],
    ['04','CAL','calendar-*','Tạo lịch bằng mẫu; quá hạn dùng mẫu overdue. Lịch không được seed sẵn để không bỏ qua ca tạo.'],
    ['05','PORT','portfolio-paper-1…5, portfolio-patent, portfolio-teaching','Tự tạo 5 bài báo + 1 sáng chế + 1 giáo trình qua UI. An seed có 8 hồ sơ nghiên cứu nên đủ ít nhất 14 hồ sơ nhóm nghiên cứu, đồng thời có dữ liệu nhóm Giảng dạy. Không upload các mẫu này như import thành tích vì UI chưa có chức năng đó.'],
    ['06','NOTI','main, reasons','Thông báo sinh ra từ flow của chính mình; không chờ người 2.'],
  ] : [
    ['01','AUTH','auth, password','Trước giờ test, chạy seed bổ sung ui.t2.password trên ENV-T2. Dùng riêng tài khoản này cho AUTH-07.'],
    ['02','REP-01…05; đọc AI/REG','ai','Đối chiếu baseline trước khi sửa/thu hồi. Có R02 và RT01 sẵn, không đợi luồng người 1.'],
    ['03','ACH','achievement, collective, reasons','Dùng các A02/A03/A05…A10/T01/T02 theo ca; nháp mới dùng prefix T2.'],
    ['04','KPI; REG/AI ghi','kpi, regulation, ai, external','File nhập trong kpi/. Preview trước khi ghi; AI thiếu nguồn chính thức ghi Bị chặn, không xác nhận văn bản giả.'],
    ['05','REP-06','report-revoke, reasons','Tự tạo quyết định/sổ REPORT-REVOKE; ghi số trước → tự thu hồi → so báo cáo, không dùng sổ của người 1.'],
    ['06','UX','long, double, consistency','Tự dựng DOUBLE và CONSISTENCY qua UI trước ca tương ứng; không dùng người 1 để tạo hộ.'],
    ['07','ORG/ADM','organization, admin, catalog','Chạy cuối; điều chuyển Linh sau ca baseline. Không khóa tài khoản An/Bích/Cường hoặc sửa nguồn seed.'],
  ];
  write('04_RUN_ORDER.md',`# Thứ tự dùng bộ dữ liệu người ${t}\n\n`+table([['Chặng','Ca','Mẫu trong copy/','Cách dùng'],['---','---','---','---'],...stages])+'\n\nMỗi chặng tự làm bằng các role riêng trong môi trường của mình; không có bước bàn giao cho tester khác. Khi thiếu điều kiện hoặc UI lỗi, ghi Bị chặn/Lỗi rồi chuyển ca độc lập.\n');
  write('05_BASELINE.md',`# Seed ban đầu và dữ liệu phải tạo qua UI\n\n${baseline}\n\nTrước khi test, SCN chuẩn có 10 tài khoản, 12 thành tích, 8 đề nghị, 4 sổ thưởng, 4 KPI, 2 phiên AI mô phỏng. ${t===2 ? 'Người phụ trách thêm tài khoản ui.t2.password bằng script bổ sung nên ENV-T2 có 11 tài khoản; không thêm thành tích/KPI/sổ thưởng.' : 'ENV-T1 không cần tài khoản bổ sung.'}\n\nLịch ban đầu trống. Dữ liệu phân trang, lịch, nhập KPI, hồ sơ DOUBLE/CONSISTENCY và tài khoản quản trị mới được tạo lúc test bằng UI theo mẫu. Chúng không được tự import vào database để tránh bỏ qua ca tạo dữ liệu.\n\nBản database hiện tại có thể có thêm phiên AI từ lượt kiểm tra trước. Người phụ trách ghi đúng ngày seed/baseline của từng môi trường; không coi hiện tại đã có hai môi trường sẵn sàng.\n`);
  write('06_UPLOAD_EXPECTATIONS.md','# Chọn file đúng mục đích\n\n| File | Mong đợi |\n| --- | --- |\n| uploads/valid/evidence-v1.pdf | PDF minh chứng ban đầu, tải về mở được |\n| uploads/valid/evidence-v2.pdf | Nội dung và SHA khác v1, dùng khi tải phiên bản mới |\n| uploads/valid/decision-demo.pdf | File quyết định mô phỏng cho sổ thưởng |\n| uploads/valid/evidence-image.png / .jpg | Ảnh hợp lệ nếu muốn kiểm thêm định dạng ảnh |\n| uploads/invalid/empty.pdf | 0 byte, phải bị từ chối |\n| uploads/invalid/not-supported.txt | Sai định dạng minh chứng |\n| uploads/invalid/fake-pdf.pdf | Nội dung văn bản nhưng đổi đuôi PDF, phải bị từ chối |\n| uploads/invalid/over-10mb.pdf | 10 MB + 1 byte, phải bị chặn kích thước |\n\nV2 là thêm phiên bản của minh chứng cũ khi UI có chức năng; không nhầm tạo một minh chứng mới rồi kết luận đã test lịch sử phiên bản. Link file private chỉ kiểm bằng URL thực tế lấy được từ UI. Nếu UI chỉ tạo blob: mà không cung cấp đường dẫn tải có thể kiểm, ghi giới hạn ca NOTI-03/04, không tự dựng API URL để thay thế kiểm thử UI.\n');
  write('07_BUG_TEMPLATE.md',`# Bug log người ${t}\n\nMã: BUG-T${t}-001\nMôi trường: ENV-T${t}\nCa liên quan:\nTài khoản / trạng thái trước:\nCác bước tái hiện:\n1.\n2.\nMong đợi:\nThực tế:\nẢnh/video/file:\nMức độ:\nNgày / người test:\nKết quả test lại:\n`);
  write('00_ENV_SETUP.md', fs.readFileSync(path.join(root,'docs/testing/kits/ENV_SETUP.md'),'utf8'));
  write('README.md',`# Bộ chuẩn bị người test ${t}\n\n**Bắt đầu:** mở [Thứ tự chạy](04_RUN_ORDER.md), sau đó [Test plan của mình](01_TEST_PLAN.md).\n\n- [Dữ liệu copy theo từng form](02_COPY_DATA.md), hoặc mở từng tệp .txt trong copy/.\n- [Tra đúng file/dữ liệu theo từng ID ca](03_FILES_BY_CASE.md) — đủ ${cases.length} ca.\n- [Baseline ban đầu](05_BASELINE.md), [file hợp lệ/lỗi](06_UPLOAD_EXPECTATIONS.md), [mẫu ghi bug](07_BUG_TEMPLATE.md).\n${t===2 ? '- File nhập KPI: [CSV hợp lệ](kpi/import-valid.csv), [XLSX hợp lệ](kpi/import-valid.xlsx), [TSV hợp lệ](kpi/import-valid.tsv); xem [kết quả mong đợi từng file](kpi/EXPECTED.md).\n' : ''}\nMọi tên/tài liệu là dữ liệu MÔ PHỎNG. File cố ý hỏng nằm riêng trong uploads/invalid/. Không đổi cấu hình hoặc reset database khi đang test.\n\nBộ này không tự chạy test, không tự ghi dữ liệu, không chứa key/token thật. Hai người vẫn cần ENV-T1/ENV-T2 riêng đã nạp SCN. File Excel là dữ liệu đầu vào upload KPI; chưa xuất test plan thành Excel. Ngày ví dụ: 19/10/2026. Nếu chạy ngày khác, chỉnh ngày lịch/quyết định/hiệu lực cho phù hợp và chọn đúng kỳ seed đang mở.\n`);
  const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir,entry.name)) : [path.join(dir,entry.name)]);
  const files = walk(out).filter(file=>!file.endsWith('MANIFEST.json')).map(file=>({ path:path.relative(out,file).replaceAll('\\','/'), bytes:fs.statSync(file).size, sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
  write('MANIFEST.json',JSON.stringify({ tester:t, run:'R01', sampleDate:runDate, cases:cases.map(row=>row[0]), forms:Object.keys(forms), files },null,2));
  console.log(`Tester ${t}: ${cases.length} case mappings, ${Object.keys(forms).length} form samples, ${files.length+1} files ready.`);
}
console.log('Prepared files only. No database connection, reset or UI test was executed.');
