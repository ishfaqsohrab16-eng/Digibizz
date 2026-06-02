-- Activate student user accounts that completed first-time password setup
-- before the application also updated user.user_status.
--
-- This only targets students whose LMS profile is active and whose user account
-- already has a stored password. Suspended students with std_lms_status = 2 are
-- intentionally excluded.

UPDATE `user` u
JOIN `student` s ON s.user_id = u.user_id
SET u.user_status = 1
WHERE u.user_type = 'student'
  AND u.user_status = 0
  AND s.std_lms_status = 1
  AND u.user_password IS NOT NULL
  AND u.user_password <> '';
