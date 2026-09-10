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
  /**
   * Slide decks, which is what most teaching material actually is.
   *
   * They were not on the list, so trainers uploading a lesson were refused
   * with "Invalid file type" and no way to comply - the format the course is
   * taught in was the one format the form would not take.
   */
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip", // Add this for Windows ZIP files
  "application/octet-stream": "zip", // Add this for generic binary files
};

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/user-learning-resurses";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = ALLOWED_FILE_TYPES[file.mimetype];
    cb(null, `learning-resurses-${uniqueSuffix}.${fileExt}`);
  },
});

/**
 * 25MB. A slide deck with images in it is not a 5MB file, and teaching
 * material is uploaded once by staff rather than constantly by everybody.
 */
const FILE_SIZE_LIMIT = 25 * 1024 * 1024;

const upload = multer({
  storage: storage,
  fileFilter: filterFor(ALLOWED_FILE_TYPES, "Learning resources"),
  limits: {
    fileSize: FILE_SIZE_LIMIT,
  },
});

module.exports = {
  upload,
  handleUploadError: handleUploadError(FILE_SIZE_LIMIT),
  FILE_SIZE_LIMIT,
};
