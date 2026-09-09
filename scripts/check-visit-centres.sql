-- Why a centre is, or is not, offered for a weekly visit.
--
-- utils/visitScope.js decides that from three things, and this shows all three
-- side by side so a missing centre - or a missing Online Cell - can be traced
-- to the row responsible instead of guessed at.
--
--   1. AN ALLOCATION in trainers_center_allocation for this batch. A centre
--      with no class is a building, and visiting it would report on nothing.
--   2. THE MEDIUM. Online and Hybrid centres are not listed by name; they are
--      folded into the single Online Cell. Physical centres are listed.
--   3. ITS OWN DATES in centers_dates. A centre that has not opened yet, or
--      has finished, is not on the list. NO ROW COUNTS AS RUNNING - an absent
--      record is a gap in the calendar, not evidence that nobody taught.
--
-- Set the batch id, then read the medium column: if nothing says Online or
-- Hybrid, the Online Cell is correctly absent, and the fix is on the centre
-- itself (Centres -> edit -> Medium), not in this module.
--
-- Usage:  mysql -u USER -p DBNAME < scripts/check-visit-centres.sql

SET @tb_id = 1;   -- <<< the batch shown in the batch picker

SELECT
  c.center_id,
  c.center_name,
  c.center_medium,
  CASE
    WHEN LOWER(TRIM(c.center_medium)) IN ('online', 'hybrid') THEN 'Online Cell'
    ELSE 'listed by name'
  END                                              AS appears_as,
  COALESCE(DATE_FORMAT(cd.tb_start, '%Y-%m-%d'), '(none)') AS starts,
  COALESCE(DATE_FORMAT(cd.tb_end,   '%Y-%m-%d'), '(none)') AS ends,
  CASE
    WHEN cd.center_id IS NULL THEN 'yes - no dates recorded, so treated as running'
    WHEN CURDATE() BETWEEN cd.tb_start AND cd.tb_end THEN 'yes'
    WHEN CURDATE() < cd.tb_start THEN 'no - has not started'
    ELSE 'no - finished'
  END                                              AS running_today,
  COUNT(DISTINCT a.t_id)                           AS trainers_allocated
FROM trainers_center_allocation AS a
JOIN centers AS c
  ON c.center_id = a.center_id
LEFT JOIN centers_dates AS cd
  ON cd.center_id = a.center_id
 AND cd.tb_id     = a.tb_id
WHERE a.tb_id = @tb_id
GROUP BY
  c.center_id, c.center_name, c.center_medium,
  cd.center_id, cd.tb_start, cd.tb_end
ORDER BY appears_as DESC, c.center_name;

-- Every centre that COULD join the Online Cell, whether or not it is teaching
-- in this batch. If this comes back empty, no centre has ever been marked
-- Online or Hybrid - center_medium defaults to 'Physical', so a centre added
-- without choosing one is Physical whatever it is in real life.
SELECT center_id, center_name, center_medium, center_status
FROM centers
WHERE LOWER(TRIM(center_medium)) IN ('online', 'hybrid')
ORDER BY center_name;
