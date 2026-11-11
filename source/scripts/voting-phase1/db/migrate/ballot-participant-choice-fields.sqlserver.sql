-- Ballot questions: single vs multiple choice; ordered participant options.

IF COL_LENGTH(N'dbo.vote_ballots', N'selection_mode') IS NULL
BEGIN
  ALTER TABLE dbo.vote_ballots
    ADD selection_mode NVARCHAR(20) NOT NULL
      CONSTRAINT DF_vote_ballots_selection_mode DEFAULT N'single';
END;
GO

IF COL_LENGTH(N'dbo.vote_ballots', N'max_selections') IS NULL
BEGIN
  ALTER TABLE dbo.vote_ballots
    ADD max_selections INT NULL;
END;
GO

IF COL_LENGTH(N'dbo.vote_candidates', N'sort_order') IS NULL
BEGIN
  ALTER TABLE dbo.vote_candidates
    ADD sort_order INT NOT NULL CONSTRAINT DF_vote_candidates_sort_order DEFAULT 0;
END;
GO

IF COL_LENGTH(N'dbo.vote_votings', N'legacy_code') IS NOT NULL
BEGIN
  ALTER TABLE dbo.vote_votings DROP COLUMN legacy_code;
END;
GO
