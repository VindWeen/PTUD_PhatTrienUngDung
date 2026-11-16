-- Manual, explicitly confirmed transcription supports scanned/image-only sources.
ALTER TABLE app.regulation_source_files ADD extraction_method varchar(8) NOT NULL
 CONSTRAINT DF_reg_source_extraction_method DEFAULT 'AUTO' WITH VALUES;
GO
ALTER TABLE app.regulation_source_files ADD CONSTRAINT CK_reg_source_extraction_method
 CHECK(extraction_method IN ('AUTO','MANUAL'));
GO
