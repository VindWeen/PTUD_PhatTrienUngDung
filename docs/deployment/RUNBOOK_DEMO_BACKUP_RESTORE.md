# Backup và khôi phục SQL Server

scripts/backup.mjs dùng BACKUP DATABASE COPY_ONLY WITH CHECKSUM và sao chép privatefiles cùng manifest SHA256. Cần đường dẫn server nhìn thấy và tài khoản SQLservice có quyền ghi; khi Node không đọc được thư mục SQL mặc định, truyền --server-backup-dir=ABSOLUTE_SHARED_FOLDER.

Từ backend: npm run backup -- --out-dir=ABSOLUTE_NEW_BACKUP_FOLDER --server-backup-dir=ABSOLUTE_SHARED_FOLDER. Chạy --help để xem tùy chọn. Tệp BAK không chứa kho minh chứng private; manifest chỉ được xác nhận hoàn chỉnh khi tất cả metadata/tệp/hash khớp. Khi thiếu tệp, công cụ phải báo lỗi, không coi BAK đơn lẻ là backup đầy đủ.

Khôi phục chỉ nhận database mới, tên explicit có restore/test, khác DB nguồn/DB đang dùng/system; không WITH REPLACE và không ghi đè thư mụcstorage. scripts/restore.mjs --backup-dir=FOLDER --verify-only xác minharchive rồi RESTOREVERIFYONLY. Thực hiện restore cần --target-db=PTUD_restore_UNIQUE --target-storage-dir=NEW_FOLDER --apply. SQL_RESTORE_USER/PASSWORD là thông tin riêng nếu loginruntime không có quyền restore. Không đưa password vào commandline/log.

Ngày11/11/2026 đã tạo nativeBAK, chạy VERIFYONLY WITHCHECKSUM, RESTORE vào PTUD_LHU_RestoreTest và DBCCCHECKDB.53bảng nghiệp vụ/609bản ghi ở checkpoint khớp bản sao nguồn. DB test được giữ lại, không ghi đè PTUD_LHU.

Giới hạn hiện tại:13/14tệp private khớpSHA256, một tệp demo cũ bị thiếu. Vì vậy nativeDBrestore PASS, backup đầy đủ cảDBvàtệp chưa đạt. Cần tìm đúng tệp gốc, đối chiếuhash rồi chạy lại fullbackup/restore; không bỏ điều kiện kiểm để nhậnPASS. Các log/hồ sơ checkpoint nội bộ ở tmp/sqlserver-engine-backups và tmp/sqlserver-migration.
