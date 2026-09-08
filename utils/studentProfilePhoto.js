const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const StudentsDocs = require("../models/studentsDocsModel");

/**
 * Fall back to the passport photo when a student has no usable profile picture.
 *
 * Every student uploads a passport-size photograph as one of their required
 * documents, so a student with no profile picture is almost never a student we
 * have no photograph of - it is one whose photograph is filed under documents
 * instead. Showing a grey silhouette next to a record that contains the
 * person's face is a gap nobody has to accept.
 *
 * THE PHOTO IS COPIED, NEVER MOVED. It is a document first: it was submitted
 * as evidence, it is approved or rejected as evidence, and the documents
 * screen has to keep showing it. The copy in uploads/user-profiles is a second
 * file that happens to look the same, and deleting a profile picture later
 * cannot take a document with it.
 *
 * WHAT COUNTS AS "NO USABLE PICTURE". Not just an empty column. A path that
 * points at a file which is no longer on disk renders as a broken image, which
 * looks worse than no picture at all, and is the more common case - files go
 * missing when a container is redeployed without its volume, or when somebody
 * clears an upload directory. So the file is checked, not just the column.
 */

/** Where profile pictures live, matching middleware/uploadConfig.js. */
const PROFILE_DIR = "uploads/user-profiles";

/** The document type holding the passport-size photograph. */
const PASSPORT_DOC_TYPE = "passport_photo";

/**
 * Everything under here is servable and nothing above it is.
 *
 * A path out of the database is not to be trusted with a filesystem read; one
 * containing ".." would otherwise reach anywhere on the disk.
 */
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");

/**
 * A profile picture has to be an image.
 *
 * Documents may be PDFs, spreadsheets or archives - all valid evidence, none
 * of them something a browser will render in an avatar.
 */
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/** A rejected document is not evidence of anything, so it is not a photo. */
const REJECTED = 2;

/**
 * Turn a stored path into an absolute one, or null if it escapes uploads.
 *
 * Stored paths are web paths beginning "/uploads/", which is exactly what a
 * naive path.join would treat as the root of the disk.
 */
const resolveUpload = (stored) => {
  const clean = String(stored || "").trim();
  if (!clean) return null;

  const relative = clean.replace(/^\/+/, "").replace(/^uploads[/\\]/i, "");
  if (!relative) return null;

  const absolute = path.resolve(UPLOAD_ROOT, relative);
  // path.resolve collapses "..", so this catches traversal after the fact
  // rather than trying to spot it in the string beforehand.
  if (absolute !== UPLOAD_ROOT && !absolute.startsWith(UPLOAD_ROOT + path.sep)) {
    return null;
  }
  return absolute;
};

/**
 * Is this stored path a picture that is actually there?
 *
 * An empty file counts as missing. A half-written upload leaves one behind,
 * and it renders as a broken image exactly like an absent file does.
 */
const isUsablePhoto = async (stored) => {
  const absolute = resolveUpload(stored);
  if (!absolute) return false;

  try {
    const stats = await fsp.stat(absolute);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
};

/** The same check, for callers that cannot await. */
const isUsablePhotoSync = (stored) => {
  const absolute = resolveUpload(stored);
  if (!absolute) return false;

  try {
    const stats = fs.statSync(absolute);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
};

/**
 * The passport photograph to copy, or null.
 *
 * Approved first, then still-awaiting-review, and the newest of either -
 * a student who has uploaded a replacement meant the replacement. A rejected
 * one is never used: somebody looked at it and said it would not do.
 */
const findPassportPhoto = async (std_cnic) => {
  const cnic = String(std_cnic || "").trim();
  if (!cnic) return null;

  const docs = await StudentsDocs.findAll({
    where: { std_cnic: cnic, doc_type: PASSPORT_DOC_TYPE },
    raw: true,
  });

  const usable = [];
  for (const doc of docs) {
    if (Number(doc.doc_status) === REJECTED) continue;
    if (!IMAGE_EXTENSIONS.has(path.extname(String(doc.doc_file || "")).toLowerCase())) {
      continue;
    }
    if (!(await isUsablePhoto(doc.doc_file))) continue;
    usable.push(doc);
  }

  if (usable.length === 0) return null;

  usable.sort((a, b) => {
    const approved = (doc) => (Number(doc.doc_status) === 1 ? 0 : 1);
    // doc_id ascends with time and is always there; doc_date is a free-text
    // string and is not reliably comparable.
    return approved(a) - approved(b) || Number(b.doc_id) - Number(a.doc_id);
  });

  return usable[0];
};

/**
 * Copy a document into the profile-picture directory.
 *
 * A new file with a new name, following the convention multer uses for the
 * uploads it writes there. The name deliberately carries nothing about the
 * student: profile pictures are served publicly, and a CNIC in a URL is a
 * CNIC published.
 */
const copyIntoProfiles = async (docFile) => {
  const source = resolveUpload(docFile);
  if (!source) return null;

  const extension = path.extname(docFile).toLowerCase();
  const name = `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const directory = path.resolve(UPLOAD_ROOT, "user-profiles");

  await fsp.mkdir(directory, { recursive: true });
  await fsp.copyFile(source, path.join(directory, name));

  return `/${PROFILE_DIR}/${name}`;
};

/**
 * Give this student a profile picture from their documents if they need one.
 *
 * Returns what the profile picture should now be - which is the existing one,
 * untouched, whenever there is nothing wrong with it. Only a student whose
 * picture is missing or broken is touched at all, so this is safe to call on
 * the way past.
 *
 * `user` is a Sequelize instance and is saved when it changes. Pass
 * `{ persist: false }` to find out what would happen without writing.
 */
const ensureProfilePhoto = async (user, student, { persist = true } = {}) => {
  if (!user || !student) return null;

  const current = user.user_profile_photo;
  if (await isUsablePhoto(current)) return current;

  const doc = await findPassportPhoto(student.std_cnic);
  if (!doc) return null;

  const copied = await copyIntoProfiles(doc.doc_file);
  if (!copied) return null;

  if (persist) {
    user.user_profile_photo = copied;
    await user.save();
  }

  return copied;
};

module.exports = {
  PROFILE_DIR,
  PASSPORT_DOC_TYPE,
  resolveUpload,
  isUsablePhoto,
  isUsablePhotoSync,
  findPassportPhoto,
  copyIntoProfiles,
  ensureProfilePhoto,
};
