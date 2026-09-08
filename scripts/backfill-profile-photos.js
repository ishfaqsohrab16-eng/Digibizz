/**
 * Give every student without a usable profile picture the passport photograph
 * they already submitted as a document.
 *
 * The application does this on its own from now on - when the photograph is
 * uploaded, and again whenever a profile is opened - so this exists to clear
 * the backlog in one pass rather than one student at a time as somebody
 * happens to look at them.
 *
 * WHAT COUNTS AS NEEDING ONE. An empty column, or a path pointing at a file
 * that is not on the disk. The second is the common case and the easy one to
 * miss: the column looks populated and the page shows a broken image.
 *
 * THE DOCUMENT IS NEVER TOUCHED. A copy goes into uploads/user-profiles; the
 * photograph stays filed under the student's documents, where it was
 * submitted as evidence and where it is approved or rejected.
 *
 * A REJECTED PHOTOGRAPH IS NEVER USED. Somebody looked at it and said it
 * would not do, and that judgement is not overridden here.
 *
 * Usage, from the project root:
 *
 *   node scripts/backfill-profile-photos.js            # dry run, copies nothing
 *   node scripts/backfill-profile-photos.js --apply    # writes
 *   node scripts/backfill-profile-photos.js --batch 12 # one batch only
 *   node scripts/backfill-profile-photos.js --apply --verbose
 */

require("dotenv").config();

const { sequelize } = require("../config/db");
const Student = require("../models/studentModel");
const User = require("../models/userModel");
const {
  isUsablePhoto,
  findPassportPhoto,
  ensureProfilePhoto,
} = require("../utils/studentProfilePhoto");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const verbose = args.includes("--verbose");

const batchArg = args.indexOf("--batch");
const onlyBatch = batchArg !== -1 ? Number(args[batchArg + 1]) : null;

if (batchArg !== -1 && !Number.isInteger(onlyBatch)) {
  console.error("--batch needs a batch id, e.g. --batch 12");
  process.exit(1);
}

const main = async () => {
  await sequelize.authenticate();

  const students = await Student.findAll({
    where: onlyBatch ? { tb_id: onlyBatch } : {},
    attributes: ["std_id", "std_cnic", "std_rollno", "tb_id", "user_id"],
  });

  console.log(
    `${students.length} students${onlyBatch ? ` in batch ${onlyBatch}` : ""}. Checking pictures...`
  );

  const copied = [];
  const alreadyFine = [];
  const noPassport = [];
  const noAccount = [];

  for (const student of students) {
    const account = await User.findOne({ where: { user_id: student.user_id } });

    if (!account) {
      noAccount.push(student);
      continue;
    }

    if (await isUsablePhoto(account.user_profile_photo)) {
      alreadyFine.push(student);
      continue;
    }

    // Asked separately from the copy so a student with nothing to copy can be
    // reported as that rather than as an unexplained failure.
    const doc = await findPassportPhoto(student.std_cnic);
    if (!doc) {
      noPassport.push(student);
      continue;
    }

    if (apply) {
      const photo = await ensureProfilePhoto(account, student);
      if (!photo) {
        noPassport.push(student);
        continue;
      }
      if (verbose) console.log(`  ${student.std_rollno || student.std_cnic}: ${photo}`);
    } else if (verbose) {
      console.log(`  ${student.std_rollno || student.std_cnic}: would copy ${doc.doc_file}`);
    }

    copied.push(student);
  }

  console.log("");
  console.log(`  ${copied.length} ${apply ? "given a picture" : "would be given a picture"}`);
  console.log(`  ${alreadyFine.length} already had a working one`);
  console.log(`  ${noPassport.length} have no usable passport photograph on file`);
  if (noAccount.length > 0) {
    console.log(`  ${noAccount.length} have no account record - nothing to set a picture on`);
  }

  if (noPassport.length > 0) {
    console.log("");
    console.log(
      "Students with no usable passport photograph either never uploaded one, " +
        "uploaded something that is not an image, had it rejected at review, or " +
        "their document file is missing from the disk too. Those need the " +
        "photograph uploading again on the documents screen, which will set the " +
        "picture by itself."
    );
  }

  if (!apply) {
    console.log("");
    console.log("Dry run - nothing was copied. Re-run with --apply to make these changes.");
  }
};

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Backfill failed:", error.message);
    try {
      await sequelize.close();
    } catch {
      /* already gone */
    }
    process.exit(1);
  });
