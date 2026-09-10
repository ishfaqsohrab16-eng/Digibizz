const multer = require("multer");

/**
 * Turning a rejected upload into something the person who made it can act on.
 *
 * A WRONG FILE IS NOT A SERVER FAULT. The filter used to reject one with a
 * bare `new Error(...)`, which is not a MulterError, so the handler passed it
 * to `next()` and it came out of the global handler as a 500 with a stack
 * trace in the log. Nothing was broken - somebody picked a PowerPoint where
 * the form takes a PDF - and the reply said "server error" while the log
 * filled with busboy internals.
 *
 * So a rejection carries its own reason and comes back as 400, and the log
 * gets one line saying who sent what.
 *
 * SAY WHAT WAS WRONG AND WHAT IS ALLOWED. "Invalid file type" leaves somebody
 * guessing at their own file and at the rule. The messages here name the type
 * that was sent, list the extensions that would work, and give the size limit
 * in the same units the person's computer showed them.
 */

/** A rejection the handler below recognises as the user's, not the server's. */
class UploadRejected extends Error {
  constructor(message) {
    super(message);
    this.name = "UploadRejected";
    this.status = 400;
  }
}

const megabytes = (bytes) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;

/**
 * A file filter from a map of accepted MIME types.
 *
 * `label` is what the form is for, so the message can say "Learning resources
 * accept ..." rather than repeating a bare list with no subject.
 */
const filterFor = (allowedTypes, label = "This upload") => {
  const extensions = [...new Set(Object.values(allowedTypes))]
    .map((extension) => extension.toUpperCase())
    .sort();

  return (req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(allowedTypes, file.mimetype)) {
      return cb(null, true);
    }

    // The name matters more than the MIME type to the person reading this:
    // they chose a file, not a media type.
    const name = file.originalname ? `"${file.originalname}"` : "That file";

    cb(
      new UploadRejected(
        `${name} is a ${file.mimetype || "file of unknown type"}, which ${label.toLowerCase()} ` +
          `cannot accept. Allowed: ${extensions.join(", ")}.`
      ),
      false
    );
  };
};

/**
 * One error handler for every upload route.
 *
 * Mount it directly after the multer middleware, so a rejection is answered
 * here instead of travelling to the global handler as an unexplained 500.
 */
const handleUploadError = (limitBytes) => (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `That file is too large. The most this form accepts is ${megabytes(limitBytes)}.`
        : err.code === "LIMIT_FILE_COUNT"
          ? "Too many files at once. Send fewer and try again."
          : err.code === "LIMIT_UNEXPECTED_FILE"
            ? `This form was not expecting a file in "${err.field}".`
            : err.message;

    console.warn(
      `[upload] ${err.code} on ${req.method} ${req.originalUrl} (field ${err.field || "?"})`
    );
    return res.status(400).json({ success: false, code: err.code, message });
  }

  if (err instanceof UploadRejected) {
    // One line, not a stack: somebody picked the wrong file, and the stack
    // says nothing about that except which parser noticed.
    console.warn(`[upload] rejected on ${req.method} ${req.originalUrl}: ${err.message}`);
    return res
      .status(400)
      .json({ success: false, code: "INVALID_FILE_TYPE", message: err.message });
  }

  return next(err);
};

module.exports = { UploadRejected, filterFor, handleUploadError, megabytes };
