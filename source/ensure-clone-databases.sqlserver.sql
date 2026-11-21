-- Optional: create isolated control-plane database for AppEndO-Release clone line.
-- Run in SSMS or: sqlcmd -S localhost\SQL2025 -E -i ensure-clone-databases.sqlserver.sql
IF DB_ID(N'AppEndORelease') IS NULL
  CREATE DATABASE [AppEndORelease];
GO