-- One-time rename: vote_elections → vote_votings, election_id → voting_id (dev cutover).
-- Idempotent where possible.

IF OBJECT_ID(N'dbo.vote_elections', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.vote_votings', N'U') IS NULL
BEGIN
  EXEC sp_rename N'dbo.vote_elections', N'vote_votings';
END;
GO

IF COL_LENGTH(N'dbo.vote_ballots', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_ballots', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_ballots.election_id', N'voting_id', N'COLUMN';
GO
IF COL_LENGTH(N'dbo.vote_candidates', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_candidates', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_candidates.election_id', N'voting_id', N'COLUMN';
GO
IF COL_LENGTH(N'dbo.vote_voter_registrations', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_voter_registrations', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_voter_registrations.election_id', N'voting_id', N'COLUMN';
GO
IF COL_LENGTH(N'dbo.vote_polling_stations', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_polling_stations', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_polling_stations.election_id', N'voting_id', N'COLUMN';
GO
IF COL_LENGTH(N'dbo.vote_observers', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_observers', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_observers.election_id', N'voting_id', N'COLUMN';
GO
IF COL_LENGTH(N'dbo.vote_cast_events', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_cast_events', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_cast_events.election_id', N'voting_id', N'COLUMN';
GO
IF COL_LENGTH(N'dbo.vote_poll_questions', N'election_id') IS NOT NULL AND COL_LENGTH(N'dbo.vote_poll_questions', N'voting_id') IS NULL
  EXEC sp_rename N'dbo.vote_poll_questions.election_id', N'voting_id', N'COLUMN';
GO

UPDATE child
SET title = N'Voting statuses'
FROM dbo.base_info AS child
INNER JOIN dbo.base_info AS root ON child.parent_id = root.id
WHERE root.parent_id IS NULL
  AND root.title = N'Voting'
  AND child.title = N'Election statuses';
GO
