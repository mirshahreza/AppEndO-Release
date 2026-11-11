-- Optional: create isolated control-plane databases for release-cut clone lines.
-- Run in SSMS or: sqlcmd -S localhost -U sa -i ensure-clone-databases.sqlserver.sql
IF DB_ID(N'AppEndORelease') IS NULL
  CREATE DATABASE [AppEndORelease];
GO
IF DB_ID(N'AppEndOHawiety') IS NULL
  CREATE DATABASE [AppEndOHawiety];
GO
