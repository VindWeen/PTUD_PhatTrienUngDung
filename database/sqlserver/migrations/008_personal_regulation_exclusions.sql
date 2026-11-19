CREATE TABLE app.regulation_personal_exclusions (
    user_id bigint NOT NULL,
    regulation_version_id bigint NOT NULL,
    CONSTRAINT PK_regulation_personal_exclusions PRIMARY KEY (user_id, regulation_version_id),
    CONSTRAINT FK_regulation_exclusions_user FOREIGN KEY (user_id) REFERENCES app.users(id),
    CONSTRAINT FK_regulation_exclusions_version FOREIGN KEY (regulation_version_id) REFERENCES app.regulation_versions(id)
);
