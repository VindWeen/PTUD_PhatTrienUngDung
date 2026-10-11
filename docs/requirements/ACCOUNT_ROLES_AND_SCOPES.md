# Tài khoản, vai trò và phạm vi quản lý

Ghi chú theo code hiện tại, cập nhật ngày 11/10/2026. Dùng để tra cứu nghiệp vụ và bàn giao cho agent; không phải đề xuất tính năng mới.

## Mô hình chính

**Một tài khoản có thể có nhiều vai trò và nhiều phạm vi quản lý. Mỗi phạm vi gắn với tài khoản, một vai trò cụ thể và một đơn vị.**

| Thành phần | Bảng dữ liệu | Ý nghĩa |
|---|---|---|
| Tài khoản | `app.users` | Danh tính đăng nhập và trạng thái tài khoản |
| Danh mục vai trò | `app.roles` | Các vai trò hệ thống đã định nghĩa |
| Vai trò tài khoản | `app.user_roles` | Gán vai trò cho tài khoản, kèm thời hạn và thông tin thu hồi |
| Phạm vi quản lý | `app.user_unit_scopes` | Gán phạm vi đơn vị cho tài khoản theo một vai trò, có thể bao gồm đơn vị con |
| Đại diện có hạn | `app.unit_representatives` | Gán tài khoản đại diện một tập thể cụ thể trong thời hạn xác định |

Vai trò xác định **được làm chức năng gì**. Phạm vi hoặc phân công đại diện xác định **được làm cho đơn vị nào**. Quyền thực tế còn phụ thuộc chủ hồ sơ, trạng thái hồ sơ, phân công xét duyệt và các điều kiện nghiệp vụ của từng chức năng.

## Các vai trò và phân công

| Mã hệ thống | Tên hiển thị | Cách xác định phạm vi |
|---|---|---|
| `LECTURER` | Giảng viên | Hồ sơ cá nhân theo liên kết giảng viên của tài khoản; không cấp phạm vi quản lý để kê khai cá nhân |
| `UNIT_REPRESENTATIVE` | Đại diện tập thể | Cần vai trò còn hiệu lực và phân công tại mục Đại diện có hạn |
| `MANAGER` | Quản lý đơn vị | Cần vai trò còn hiệu lực và phạm vi quản lý tương ứng |
| `COUNCIL` | Hội đồng xét duyệt | Cần vai trò, phạm vi tương ứng và phân công xét duyệt khi chức năng yêu cầu |
| `RECORDS_OFFICER` | Chuyên viên thi đua khen thưởng | Cần vai trò còn hiệu lực và phạm vi tương ứng cho nghiệp vụ theo đơn vị |
| `ADMIN` | Quản trị viên | Quản trị tài khoản, phân công và danh mục; không tự có quyền xác nhận thành tích thay Quản lý đơn vị |

API quản trị hiện cho phép tạo phạm vi cho `MANAGER`, `COUNCIL`, `RECORDS_OFFICER`. Đại diện tập thể dùng bảng phân công riêng, không dùng phạm vi quản lý.

## Ví dụ

Tài khoản Nguyễn Văn A có hai vai trò: Giảng viên và Quản lý đơn vị. Admin cấp thêm hai phạm vi theo vai trò Quản lý đơn vị: khoa CNTT và khoa Kỹ thuật.

- A có thể kê khai thành tích cá nhân với vai trò Giảng viên.
- A có thể thẩm định hồ sơ thuộc hai phạm vi được giao khi đủ điều kiện nghiệp vụ.
- A không được tự duyệt hồ sơ của mình hoặc hồ sơ tập thể do chính mình nộp.
- Hai người cùng vai trò Quản lý đơn vị có cùng nhóm chức năng, nhưng có thể xử lý các đơn vị khác nhau vì phạm vi khác nhau.

## Cách cấp trên trang Quản trị

1. Tạo hoặc chọn tài khoản đang hoạt động tại **Tài khoản**.
2. Tại **Vai trò tài khoản**, cấp từng vai trò cần thiết cùng thời hạn hiệu lực. Một tài khoản có thể nhận nhiều vai trò.
3. Với Quản lý đơn vị, Hội đồng hoặc Chuyên viên thi đua khen thưởng: tại **Phạm vi quản lý**, chọn đúng tài khoản, vai trò và đơn vị. Có thể thêm nhiều phạm vi. Chọn **Bao gồm đơn vị con** nếu cần áp dụng xuống cây tổ chức.
4. Với Đại diện tập thể: cấp vai trò Đại diện tập thể trước, sau đó tạo **Đại diện có hạn** cho đơn vị cụ thể, bắt buộc có ngày kết thúc.

Thời hạn phạm vi hoặc đại diện phải nằm trong thời hạn vai trò tương ứng. Vai trò/phạm vi dùng khoảng `[validFrom, validTo)`: đến thời điểm kết thúc là hết hiệu lực; `validTo = null` là không hạn ở những phân công cho phép. Thu hồi giữ lịch sử, không xóa vật lý phân công. Đại diện chỉ áp dụng đúng đơn vị được giao, không tự kế thừa đơn vị con.

## Những điều cần nhớ khi phát triển

- Có vai trò không đồng nghĩa có quyền xử lý mọi đơn vị. Nơi công tác cũng không tự tạo phạm vi quản lý.
- Phạm vi của một vai trò không thay thế phạm vi cần thiết cho vai trò khác.
- Nhiều vai trò không bỏ qua quy tắc chống tự duyệt, trạng thái hồ sơ hoặc phân công Hội đồng.
- Hiện chưa có giao diện cấp từng quyền tùy ý như “được thêm nhưng không được sửa/xóa”. Chức năng theo vai trò được quy định trong backend; Admin gán vai trò và phân công.
- Menu và tên tiếng Việt chỉ hỗ trợ giao diện. Backend phải kiểm tra quyền; các mã API như `MANAGER`, `COUNCIL` vẫn giữ nguyên.

## Nguồn đối chiếu

- [Blueprint](../PROJECT_DEVELOPMENT_BLUEPRINT.md): mô hình nghiệp vụ và quyết định kiến trúc.
- [Ma trận phân quyền ban đầu](PERMISSIONS_MATRIX.md): tài liệu giai đoạn W1; đối chiếu code hiện tại khi có khác biệt.
- [API quản trị](../api/ADMIN_W2_P1.md): hợp đồng và cách gán/thu hồi phân công.
- [`adminRepository.js`](../../backend/src/modules/admin/adminRepository.js): `assign`, kiểm tra vai trò và thời hạn khi cấp phạm vi/đại diện.
- [`authRepository.js`](../../backend/src/modules/auth/authRepository.js): vai trò hiện hành và `isUnitInUserScope`, kiểm tra cây đơn vị và hiệu lực.
- [`requireScope.js`](../../backend/src/middlewares/requireScope.js): kiểm tra phạm vi tại backend, không cho Admin tự bỏ qua quyền duyệt.
