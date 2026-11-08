-- Base Info display helpers for reporting / edge SQL (SQL Server).
-- Requires: base_info, base_info_culture_text, base_info_title_path (Sequelize sync).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE OR ALTER FUNCTION dbo.zz_normalize_base_info_culture_id(@culture_id NVARCHAR(32))
RETURNS NVARCHAR(32)
AS
BEGIN
  DECLARE @c NVARCHAR(32) = LOWER(LTRIM(RTRIM(@culture_id)));
  IF @c IN (N'en', N'us', N'en-us') RETURN N'us';
  IF @c IN (N'fa', N'ir', N'fa-ir') RETURN N'ir';
  IF @c IN (N'ar', N'iq', N'ar-iq') RETURN N'iq';
  IF @c IN (N'us', N'ir', N'iq') RETURN @c;
  RETURN N'us';
END;
GO

/** Resolved display title for one node (culture-specific, not canonical). */
CREATE OR ALTER FUNCTION dbo.zz_base_info_display_title(
  @culture_id NVARCHAR(32),
  @base_info_id NVARCHAR(64)
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
  IF @base_info_id IS NULL OR LTRIM(RTRIM(@base_info_id)) = N'' RETURN NULL;

  DECLARE @culture NVARCHAR(32) = dbo.zz_normalize_base_info_culture_id(@culture_id);

  RETURN (
    SELECT COALESCE(
      NULLIF(LTRIM(RTRIM(ct.title)), N''),
      NULLIF(LTRIM(RTRIM(bi.title)), N''),
      bi.id
    )
    FROM dbo.base_info AS bi
    LEFT JOIN dbo.base_info_culture_text AS ct
      ON ct.base_info_id = bi.id AND ct.culture_id = @culture
    WHERE bi.id = @base_info_id
  );
END;
GO

CREATE OR ALTER FUNCTION dbo.zz_base_info_display_title_by_short_name(
  @culture_id NVARCHAR(32),
  @short_name NVARCHAR(256)
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
  IF @short_name IS NULL OR LTRIM(RTRIM(@short_name)) = N'' RETURN NULL;

  RETURN (
    SELECT TOP (1) dbo.zz_base_info_display_title(@culture_id, bi.id)
    FROM dbo.base_info AS bi
    WHERE bi.short_name = @short_name
  );
END;
GO

/** Path separator must match app BASE_INFO_TITLE_PATH_SEPARATOR (' | '). */
CREATE OR ALTER FUNCTION dbo.zz_base_info_path_take_depth(
  @path NVARCHAR(MAX),
  @depth INT
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
  DECLARE @trimmed NVARCHAR(MAX) = NULLIF(LTRIM(RTRIM(@path)), N'');
  IF @trimmed IS NULL RETURN NULL;
  IF @depth IS NULL OR @depth <= 0 RETURN @trimmed;

  DECLARE @sep NVARCHAR(10) = N' | ';
  DECLARE @sepLen INT = LEN(@sep);
  DECLARE @segCount INT = 1;
  DECLARE @search INT = 1;
  DECLARE @found INT;

  WHILE 1 = 1
  BEGIN
    SET @found = CHARINDEX(@sep, @trimmed, @search);
    IF @found = 0 BREAK;
    SET @segCount = @segCount + 1;
    SET @search = @found + @sepLen;
  END;

  IF @depth >= @segCount RETURN @trimmed;

  DECLARE @skip INT = @segCount - @depth;
  DECLARE @pos INT = 1;
  DECLARE @s INT = 0;

  WHILE @s < @skip
  BEGIN
    SET @found = CHARINDEX(@sep, @trimmed, @pos);
    IF @found = 0 RETURN @trimmed;
    SET @pos = @found + @sepLen;
    SET @s = @s + 1;
  END;

  RETURN LTRIM(RTRIM(SUBSTRING(@trimmed, @pos, LEN(@trimmed) - @pos + 1)));
END;
GO

/**
 * Materialized culture-specific title path (root → node).
 * @depth: optional segment count from the node upward (leaf included). NULL or <= 0 = full path to root.
 */
CREATE OR ALTER FUNCTION dbo.zz_base_info_display_title_path(
  @culture_id NVARCHAR(32),
  @base_info_id NVARCHAR(64),
  @depth INT = NULL
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
  IF @base_info_id IS NULL OR LTRIM(RTRIM(@base_info_id)) = N'' RETURN NULL;

  DECLARE @culture NVARCHAR(32) = dbo.zz_normalize_base_info_culture_id(@culture_id);
  DECLARE @full NVARCHAR(MAX);

  SELECT @full = NULLIF(LTRIM(RTRIM(p.title_path)), N'')
  FROM dbo.base_info_title_path AS p
  WHERE p.base_info_id = @base_info_id AND p.culture_id = @culture;

  RETURN dbo.zz_base_info_path_take_depth(@full, @depth);
END;
GO

CREATE OR ALTER FUNCTION dbo.zz_base_info_display_title_path_by_short_name(
  @culture_id NVARCHAR(32),
  @short_name NVARCHAR(256),
  @depth INT = NULL
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
  IF @short_name IS NULL OR LTRIM(RTRIM(@short_name)) = N'' RETURN NULL;

  RETURN (
    SELECT TOP (1) dbo.zz_base_info_display_title_path(@culture_id, bi.id, @depth)
    FROM dbo.base_info AS bi
    WHERE bi.short_name = @short_name
  );
END;
GO

PRINT 'zz_base_info_display_* functions ready';
GO
