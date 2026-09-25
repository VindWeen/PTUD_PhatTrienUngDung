-- Migration 003: Khởi tạo các bảng phân hệ Tổ chức và Phạm vi (OrganizationUnits, UserUnitScopes, UnitRepresentatives)
IF OBJECT_ID('dbo.OrganizationUnits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrganizationUnits (
        UnitId BIGINT IDENTITY(1,1) NOT NULL,
        Code VARCHAR(50) NOT NULL,
        Name NVARCHAR(150) NOT NULL,
        Type VARCHAR(30) NOT NULL,
        ParentId BIGINT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_OrgUnits_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_OrgUnits_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_OrgUnits_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_OrganizationUnits PRIMARY KEY CLUSTERED (UnitId),
        CONSTRAINT UQ_OrganizationUnits_Code UNIQUE NONCLUSTERED (Code),
        CONSTRAINT FK_OrganizationUnits_Parent FOREIGN KEY (ParentId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT CK_OrganizationUnits_Type CHECK (Type IN ('FACULTY', 'DEPARTMENT', 'DIVISION'))
    );
END;

IF OBJECT_ID('dbo.UserUnitScopes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserUnitScopes (
        UserUnitScopeId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NOT NULL,
        RoleId BIGINT NOT NULL,
        UnitId BIGINT NOT NULL,
        IncludeDescendants BIT NOT NULL CONSTRAINT DF_UserUnitScopes_IncludeDescendants DEFAULT (0),
        ValidFrom DATETIME2(3) NOT NULL CONSTRAINT DF_UserUnitScopes_ValidFrom DEFAULT (SYSUTCDATETIME()),
        ValidTo DATETIME2(3) NULL,
        AssignedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserUnitScopes_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_UserUnitScopes PRIMARY KEY CLUSTERED (UserUnitScopeId),
        CONSTRAINT FK_UserUnitScopes_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserUnitScopes_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserUnitScopes_Units FOREIGN KEY (UnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserUnitScopes_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_UserUnitScopes_Dates CHECK (ValidTo IS NULL OR ValidTo >= ValidFrom)
    );
END;

IF OBJECT_ID('dbo.UnitRepresentatives', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UnitRepresentatives (
        UnitRepresentativeId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NOT NULL,
        UnitId BIGINT NOT NULL,
        ValidFrom DATETIME2(3) NOT NULL CONSTRAINT DF_UnitRepresentatives_ValidFrom DEFAULT (SYSUTCDATETIME()),
        ValidTo DATETIME2(3) NULL,
        AssignedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UnitRepresentatives_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_UnitRepresentatives PRIMARY KEY CLUSTERED (UnitRepresentativeId),
        CONSTRAINT FK_UnitRepresentatives_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_UnitRepresentatives_Units FOREIGN KEY (UnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_UnitRepresentatives_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_UnitRepresentatives_Dates CHECK (ValidTo IS NULL OR ValidTo >= ValidFrom)
    );
END;
