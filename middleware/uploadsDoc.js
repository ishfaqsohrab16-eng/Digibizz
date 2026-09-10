const multer = require("multer");
const { filterFor, handleUploadError } = require("./uploadErrors");
const path = require("path");
const fs = require("fs");

// Define allowed file types
const ALLOWED_FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip", // Add this for Windows ZIP files
  "application/octet-stream": "zip", // Add this for generic binary files
};

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get the student CNIC from the request body
    const std_cnic = req.body.std_cnic;
    const tb_id = req.body.tb_id;
    if (!std_cnic) {
      return cb(new Error("Student CNIC is required"), null);
    }

    const uploadDir = `uploads/student_docs/batch-${tb_id}/${std_cnic}`;

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = ALLOWED_FILE_TYPES[file.mimetype];
    cb(null, `${file.fieldname}-${uniqueSuffix}.${fileExt}`);
  },
});

/**
 * 10MB, not 5.
 *
 * These are photographs of identity documents, taken on a phone. A modern
 * phone camera clears 5MB without trying, and the log showed people hitting
 * the limit over and over with no idea what the limit was - each attempt a
 * scan re-taken, and the reply saying only "file size too large".
 */
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

const upload = multer({
  storage: storage,
  fileFilter: filterFor(ALLOWED_FILE_TYPES, "Student documents"),
  limits: {
    fileSize: FILE_SIZE_LIMIT,
  },
});

module.exports = {
  upload,
  handleUploadError: handleUploadError(FILE_SIZE_LIMIT),
  FILE_SIZE_LIMIT,
};
