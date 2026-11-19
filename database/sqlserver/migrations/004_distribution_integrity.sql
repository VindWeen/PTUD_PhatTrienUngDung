-- Harden nullable SQL CHECK semantics and preserve terminal share consent.
ALTER TABLE app.regulation_shares DROP CONSTRAINT CK_reg_share_response;
ALTER TABLE app.regulation_shares ADD CONSTRAINT CK_reg_share_response CHECK(
 (status='PENDING' AND responded_at IS NULL AND responded_by_user_id IS NULL AND revoked_at IS NULL) OR
 (status IN ('ACCEPTED','REJECTED') AND responded_at IS NOT NULL AND responded_at>=created_at AND responded_by_user_id IS NOT NULL AND revoked_at IS NULL) OR
 (status='REVOKED' AND revoked_at IS NOT NULL AND revoked_at>=created_at));
GO
CREATE TRIGGER app.TR_reg_share_preserve_response ON app.regulation_shares AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.id=d.id WHERE d.status IN ('ACCEPTED','REJECTED','REVOKED') AND (
  ISNULL(i.responded_at,CONVERT(datetime2,'1900-01-01'))<>ISNULL(d.responded_at,CONVERT(datetime2,'1900-01-01')) OR
  ISNULL(i.responded_by_user_id,-1)<>ISNULL(d.responded_by_user_id,-1) OR
  (d.status='REVOKED' AND (ISNULL(i.revoked_at,CONVERT(datetime2,'1900-01-01'))<>ISNULL(d.revoked_at,CONVERT(datetime2,'1900-01-01'))))))
 THROW 51027,'Completed share response and revocation timestamps are immutable.',1;
END;
GO
