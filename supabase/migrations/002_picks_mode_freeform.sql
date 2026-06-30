-- Picks used to be tagged with one of a fixed set of dashboard "modes".
-- Crates now record the crate id as the pick's mode, so the old CHECK
-- constraint rejected every insert (the error was swallowed client-side,
-- which is why "last played" / play counts never updated).
--
-- Drop the constraint so mode can be any crate id. The auto-generated name
-- is picks_mode_check; guard with IF EXISTS in case it was already removed.
ALTER TABLE public.picks DROP CONSTRAINT IF EXISTS picks_mode_check;
