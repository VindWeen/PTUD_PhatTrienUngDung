DECLARE @pk SYSNAME = (SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'app.achievement_trash_file_cleanup') AND type = 'PK');
DECLARE @ddl NVARCHAR(MAX) = N'ALTER TABLE app.achievement_trash_file_cleanup DROP CONSTRAINT ' + QUOTENAME(@pk);
EXEC(@ddl);
ALTER TABLE app.achievement_trash_file_cleanup ALTER COLUMN storage_key NVARCHAR(450) COLLATE Latin1_General_100_BIN2 NOT NULL;
ALTER TABLE app.achievement_trash_file_cleanup ADD CONSTRAINT pk_achievement_trash_file_cleanup PRIMARY KEY (storage_key);
