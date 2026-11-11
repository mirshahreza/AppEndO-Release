-- Voting package uninstall (SQL Server) — drop in FK-safe order.

IF OBJECT_ID(N'dbo.vote_poll_answers', N'U') IS NOT NULL DROP TABLE dbo.vote_poll_answers;
GO
IF OBJECT_ID(N'dbo.vote_poll_questions', N'U') IS NOT NULL DROP TABLE dbo.vote_poll_questions;
GO
IF OBJECT_ID(N'dbo.vote_cast_events', N'U') IS NOT NULL DROP TABLE dbo.vote_cast_events;
GO
IF OBJECT_ID(N'dbo.vote_observers', N'U') IS NOT NULL DROP TABLE dbo.vote_observers;
GO
IF OBJECT_ID(N'dbo.vote_polling_stations', N'U') IS NOT NULL DROP TABLE dbo.vote_polling_stations;
GO
IF OBJECT_ID(N'dbo.vote_voter_registrations', N'U') IS NOT NULL DROP TABLE dbo.vote_voter_registrations;
GO
IF OBJECT_ID(N'dbo.vote_candidates', N'U') IS NOT NULL DROP TABLE dbo.vote_candidates;
GO
IF OBJECT_ID(N'dbo.vote_ballots', N'U') IS NOT NULL DROP TABLE dbo.vote_ballots;
GO
IF OBJECT_ID(N'dbo.vote_votings', N'U') IS NOT NULL DROP TABLE dbo.vote_votings;
GO
IF OBJECT_ID(N'dbo.vote_elections', N'U') IS NOT NULL DROP TABLE dbo.vote_elections;
GO
