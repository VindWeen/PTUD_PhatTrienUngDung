ALTER TABLE app.regulation_source_files DROP CONSTRAINT CK_reg_source_size;
ALTER TABLE app.regulation_source_files ADD CONSTRAINT CK_reg_source_size CHECK(byte_size > 0 AND byte_size <= 20971520);
