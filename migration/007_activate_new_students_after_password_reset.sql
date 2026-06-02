-- Fix students who reset their password while the application only updated
-- user.user_password and did not activate the login account.
--
-- This activates only non-suspended student accounts that already have a
-- stored password. Suspended students are intentionally excluded.

UPDATE `user` u
JOIN `students` s ON s.user_id = u.user_id
SET
  u.user_status = 1,
  s.std_lms_status = 1
WHERE u.user_type = 'student'
  AND u.user_status = 0
  AND s.std_lms_status IN (0, 1)
  AND (s.suspension_reason IS NULL OR TRIM(s.suspension_reason) = '')
  AND u.user_password IS NOT NULL
  AND u.user_password <> '';
