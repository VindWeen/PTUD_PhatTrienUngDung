# Backup và khôi phục SQL Server

## Tạo backup phối hợp

Dừng backend, seed job và mọi tiến trình ghi SQL hoặc tệp. Từ `backend/`, chạy:

```powershell
npm run backup -- --writers-stopped --out-dir=ABSOLUTE_NEW_BACKUP_FOLDER --server-backup-dir=ABSOLUTE_SHARED_FOLDER
```

`--writers-stopped` là xác nhận của người vận hành. Archive v3 gồm SQL Server BAK `COPY_ONLY` với checksum, manifest SHA-256 và hai thư mục `storage_backup/evidences/`, `storage_backup/regulations/`. `STORAGE_DIR` trỏ tới kho minh chứng và kho quy chế nằm ở thư mục sibling. SQL Server service phải ghi được BAK, còn tiến trình Node phải đọc được tệp. Archive thiếu tệp hoặc sai hash không đạt kiểm tra toàn vẹn.

## Xác minh và khôi phục

```powershell
npm run restore -- --backup-dir=ABSOLUTE_BACKUP_FOLDER --verify-only
npm run restore -- --backup-dir=ABSOLUTE_BACKUP_FOLDER --target-db=PTUD_restore_UNIQUE --target-storage-dir=ABSOLUTE_NEW_STORAGE_FOLDER --apply
```

Dùng database và thư mục đích mới. Sau khi restore v3, đặt `STORAGE_DIR` theo `targetEvidenceDirectory` trong kết quả restore. Với archive chỉ chứa minh chứng đời trước, thư mục trả về có thể khác. Dùng biến môi trường cho thông tin xác thực restore khi cần quyền riêng.

## Bằng chứng theo mốc

Checkpoint 11/11/2026 thuộc schema cũ, với 53 bảng, 609 bản ghi và 13/14 tệp private khớp hash. Lần rehearsal V2 ngày 16/11 dùng database cô lập và kiểm cả hai kho tệp. Xem [kết quả rehearsal](../testing/V2_STORAGE_BACKUP.md) và [báo cáo chuyển DB lịch sử](../testing/SQLSERVER_MIGRATION_REPORT.md).
