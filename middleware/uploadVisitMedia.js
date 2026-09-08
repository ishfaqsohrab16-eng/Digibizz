const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Photographs and video from a centre visit.
 *
 * The evidence that somebody actually went. A visit report is a page of
 * yes/no answers about a room, and the pictures are what make it more than an
 * assertion - so they are attached to the report rather than kept anywhere
 * else.
 *
 * Video is allowed because a two-minute walk through a lab says more than six
 * photographs of it, which is why the limits below are generous compared with
 * the other uploads in this application.
 */

const UPLOAD_DIR = "uploads/center-visits";

/**
 * What may be uploaded, by MIME type.
 *
 * An allowlist, not a blocklist. The extension is taken from THIS table rather
 * than from the uploaded filename, so a file called `photo.jpg.php` is stored
 * as a .jpg and there is no path by which a name someone chose becomes an
 * executable one.
 */
const ALLOWED_FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/webm": "webm",
  // Android and some phones send this for .3gp clips.
  "video/3gpp": "3gp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `visit-${unique}.${ALLOWED_FILE_TYPES[file.mimetype]}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (Object.prototype.hasOwnProperty.call(ALLOWED_FILE_TYPES, file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(
    new Error(
      `${file.mimetype} cannot be attached to a visit report. Photographs (JPG, PNG, WEBP, HEIC) and video (MP4, MOV, AVI, WEBM) only.`
    ),
    false
  );
};

/**
 * Sized for a phone.
 *
 * A minute of video off a modern handset is comfortably over 50MB, and a
 * Master Trainer standing in a lab in Quetta should not have to work out how
 * to compress it. Ten files at 80MB is the practical ceiling before the
 * request itself becomes the problem on a slow connection.
 */
const uploadVisitMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 80 * 1024 * 1024,
    files: 10,
  },
});

module.exports = { uploadVisitMedia, UPLOAD_DIR, ALLOWED_FILE_TYPES };
