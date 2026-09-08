/**
 * Tests for falling back to the passport photograph.
 *
 * Run with:  node utils/studentProfilePhoto.test.js
 * Exits non-zero if any rule regresses. Real files, but in a directory of its
 * own under the OS temp folder - never the application's own uploads tree,
 * which a test has no business creating and deleting files in. The documents
 * table is stubbed, so no database.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Set before the module under test is loaded: it reads UPLOAD_ROOT once, at
// require time, to decide where uploads live.
const UPLOAD_ROOT = path.join(
  os.tmpdir(),
  `lms-photo-test-${process.pid}-${Date.now()}`
);
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
process.env.UPLOAD_ROOT = UPLOAD_ROOT;

// Stubbed before the module under test is required, so nothing opens a socket.
let docRows = [];
const docsPath = require.resolve("../models/studentsDocsModel");
require.cache[docsPath] = {
  id: docsPath,
  filename: docsPath,
  loaded: true,
  exports: {
    findAll: async ({ where }) =>
      docRows.filter(
        (row) => row.std_cnic === where.std_cnic && row.doc_type === where.doc_type
      ),
  },
};

const {
  resolveUpload,
  isUsablePhoto,
  findPassportPhoto,
  ensureProfilePhoto,
} = require("./studentProfilePhoto");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ""}`);
  }
};

/** A real file under uploads/, cleaned up at the end. */
const written = [];
const write = (relative, contents = "x") => {
  const absolute = path.resolve(UPLOAD_ROOT, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  written.push(absolute);
  return `/uploads/${relative.replace(/\\/g, "/")}`;
};

const scratch = `test-${process.pid}`;

const main = async () => {
  console.log("\nResolving a stored path\n");

  check("a normal path resolves", Boolean(resolveUpload("/uploads/user-profiles/a.jpg")));
  check("with or without the leading slash", Boolean(resolveUpload("uploads/user-profiles/a.jpg")));
  check("an empty path resolves to nothing", resolveUpload("") === null);
  check("and so does null", resolveUpload(null) === null);

  // A path out of the database reaching outside uploads would let a stored
  // value name any file on the disk.
  check("traversal is refused", resolveUpload("/uploads/../../etc/passwd") === null);
  check("and so is a deeper one", resolveUpload("../../../etc/passwd") === null);

  console.log("\nDeciding whether a picture is usable\n");

  const real = write(`${scratch}/real.jpg`, "image bytes");
  check("a file that exists is usable", await isUsablePhoto(real));
  check("a path to nothing is not", !(await isUsablePhoto(`/uploads/${scratch}/gone.jpg`)));
  check("an empty column is not", !(await isUsablePhoto("")));

  // A half-written upload leaves a zero-byte file, which renders as a broken
  // image exactly like an absent one.
  const empty = write(`${scratch}/empty.jpg`, "");
  check("a zero-byte file is not usable", !(await isUsablePhoto(empty)));

  console.log("\nChoosing which passport photograph to copy\n");

  const approved = write(`${scratch}/approved.jpg`, "approved");
  const pending = write(`${scratch}/pending.jpg`, "pending");
  const rejected = write(`${scratch}/rejected.jpg`, "rejected");
  const pdf = write(`${scratch}/scan.pdf`, "not an image");

  docRows = [
    { doc_id: 1, std_cnic: "111", doc_type: "passport_photo", doc_file: pending, doc_status: 0 },
    { doc_id: 2, std_cnic: "111", doc_type: "passport_photo", doc_file: approved, doc_status: 1 },
  ];
  const best = await findPassportPhoto("111");
  check("an approved photo beats one awaiting review", best?.doc_id === 2, best?.doc_id);

  // Somebody looked at it and said it would not do.
  docRows = [
    { doc_id: 3, std_cnic: "222", doc_type: "passport_photo", doc_file: rejected, doc_status: 2 },
  ];
  check("a rejected photo is never used", (await findPassportPhoto("222")) === null);

  // Documents may be PDFs; an avatar may not.
  docRows = [
    { doc_id: 4, std_cnic: "333", doc_type: "passport_photo", doc_file: pdf, doc_status: 1 },
  ];
  check("a PDF is not a profile picture", (await findPassportPhoto("333")) === null);

  docRows = [
    {
      doc_id: 5,
      std_cnic: "444",
      doc_type: "passport_photo",
      doc_file: `/uploads/${scratch}/missing.jpg`,
      doc_status: 1,
    },
  ];
  check("a document whose file is gone is not used", (await findPassportPhoto("444")) === null);

  // Newest wins among equals: a student who uploaded a replacement meant it.
  docRows = [
    { doc_id: 6, std_cnic: "555", doc_type: "passport_photo", doc_file: approved, doc_status: 1 },
    { doc_id: 9, std_cnic: "555", doc_type: "passport_photo", doc_file: pending, doc_status: 1 },
  ];
  check("the newest of two approved photos wins", (await findPassportPhoto("555"))?.doc_id === 9);

  console.log("\nGiving a student a picture\n");

  const fakeUser = (photo) => {
    const user = { user_profile_photo: photo, saved: 0 };
    user.save = async () => {
      user.saved += 1;
    };
    return user;
  };

  docRows = [
    { doc_id: 10, std_cnic: "666", doc_type: "passport_photo", doc_file: approved, doc_status: 1 },
  ];

  // The whole point: a broken picture is replaced.
  const broken = fakeUser(`/uploads/${scratch}/gone.jpg`);
  const result = await ensureProfilePhoto(broken, { std_cnic: "666" });
  check("a broken picture is replaced", Boolean(result), result);
  check("and the account is saved", broken.saved === 1);
  check("with the new path", broken.user_profile_photo === result);
  if (result) written.push(path.resolve(UPLOAD_ROOT, result.replace(/^\/uploads\//, "")));

  // It is a document first. Deleting a profile picture must not be able to
  // take somebody's submitted evidence with it.
  check(
    "the document file is left where it was",
    fs.existsSync(path.resolve(UPLOAD_ROOT, approved.replace(/^\/uploads\//, "")))
  );
  check("and the copy is a different file", result !== approved);

  const fine = fakeUser(real);
  const unchanged = await ensureProfilePhoto(fine, { std_cnic: "666" });
  check("a working picture is left alone", unchanged === real, unchanged);
  check("and nothing is saved", fine.saved === 0);

  docRows = [];
  const nothing = fakeUser("");
  check(
    "a student with no photograph gets nothing rather than an error",
    (await ensureProfilePhoto(nothing, { std_cnic: "777" })) === null
  );
  check("and is not saved", nothing.saved === 0);

  // persist:false is what the dry run of the backfill relies on.
  docRows = [
    { doc_id: 11, std_cnic: "888", doc_type: "passport_photo", doc_file: approved, doc_status: 1 },
  ];
  const preview = fakeUser("");
  const would = await ensureProfilePhoto(preview, { std_cnic: "888" }, { persist: false });
  check("persist:false still reports what would happen", Boolean(would));
  check("but does not save", preview.saved === 0);
  if (would) written.push(path.resolve(UPLOAD_ROOT, would.replace(/^\/uploads\//, "")));

  check("a missing account is handled", (await ensureProfilePhoto(null, { std_cnic: "888" })) === null);
};

main()
  .then(() => {
    try {
      fs.rmSync(UPLOAD_ROOT, { recursive: true, force: true });
    } catch {
      /* already gone */
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
