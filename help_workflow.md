 # Codex Workflow For LMS DigiBizz

  ## Repo Structure

  Main project folder:

  ```bash
  lms_digibiz/

  Frontend source:

  lms_digibiz/Frontend/

  Backend/app root:

  lms_digibiz/

  Production frontend build is served from backend:

  lms_digibiz/dist/

  So after frontend changes, always build inside Frontend/ and copy Frontend/dist/ into backend dist/.

  ## Before Making Changes

  Check status first:

  cd lms_digibiz
  git status --short

  Do not revert unrelated changes.

  ## Backend Checks

  After backend JS changes, run syntax checks on touched backend files:

  node -c controllers/exampleController.js
  node -c models/exampleModel.js

  If multiple files changed:

  node -c controllers/file1.js && node -c controllers/file2.js

  ## Frontend Production Build

  Always build with production API URL:

  cd lms_digibiz/Frontend
  VITE_BACKEND_URL=https://lms.digibizz.gob.pk npm run build

  The build must pass this validation:

  Validated production API origin: https://lms.digibizz.gob.pk
  Verified dist bundle does not contain localhost-style URLs.

  ## Copy Build To Backend

  After successful frontend build:

  cd lms_digibiz
  rsync -a --delete Frontend/dist/ dist/

  This replaces the backend-served build.

  ## Verify No Localhost URLs

  Run:

  cd lms_digibiz
  rg -n "localhost:3000|localhost:5000|127\.0\.0\.1|0\.0\.0\.0" dist Frontend/dist

  Expected result: no output.

  Note: rg exit code 1 is normal when no matches are found.

  ## Final Status

  Before telling user to commit:

  cd lms_digibiz
  git status --short

  Explain:

  - What was changed.
  - Whether a migration is required.
  - Whether frontend was rebuilt and copied into backend dist.
  - Whether localhost scan passed.

  ## Migrations

  If database schema/data changes are needed, create SQL files in:

  migration/

  Naming format:

  009_readable_caption.sql

  Example:

  009_allow_student_feedback_text_null.sql

  Do not make silent database changes without a migration file.

  ## Runtime JSON Settings

  Runtime app settings are stored in:

  uploads/settings/appSettings.json

  This file is runtime data and should not be committed.

  ## Production Rule

  For production deployment, backend folder already contains dist/. The programmer may build frontend separately and paste frontend
  dist into backend dist, but Codex should do it automatically after every frontend change.

  ## Important Cautions

  Do not commit .env.

  Do not track:

  - uploads/
  - database dumps
  - studentdata.xlsx
  - insert_data.sql

  Do not use localhost API URLs in production builds.

  Do not change production API origin unless explicitly requested:

  https://lms.digibizz.gob.pk

