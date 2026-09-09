const path = require("path");
const fs = require("fs").promises;
const { sequelize } = require("../config/db");
const Student = require("../models/studentModel");
const User = require("../models/userModel");
const { safeRollback } = require("../utils/safeRollback");

/**
 * Permanently delete a student and everything linked to them.
 *
 * This is irreversible and SuperAdmin-only. It runs in a single transaction so
 * the account can never be left half-deleted: either every row goes or none
 * does. Uploaded files are removed only after the transaction commits, since a
 * failed delete would otherwise leave the database intact but the files gone.
 *
 * A student is referenced by three different keys across the schema
 * (std_id, std_cnic, std_rollno), so each table is cleaned by its own key.
 */

/** table -> which student key it is linked by. */
const LINKED_TABLES = [
  { table: "attendance", key: "std_cnic" },
  { table: "students_leaves", key: "std_cnic" },
  { table: "exam_assessment", key: "std_cnic" },
  { table: "student_quiz_attempts", key: "std_cnic" },
  { table: "students_docs", key: "std_cnic" },
  { table: "students_freelancing_profiles", key: "std_cnic" },
  { table: "assignment_submissions", key: "std_rollno" },
  { table: "students_feedback", key: "std_rollno" },
  { table: "tickets", key: "std_rollno" },
  { table: "earnings", key: "std_id" },
];

/** Columns that hold an uploaded file path, so the files can be removed too. */
const FILE_SOURCES = [
  { table: "students_docs", key: "std_cnic", column: "doc_file" },
  { table: "earnings", key: "std_id", column: "earning_proof" },
];

const UPLOAD_ROOT = path.join(__dirname, "..");

/**
 * Resolve a stored path like "/uploads/earning_proofs/x.jpg" to a real file
 * inside the uploads directory. Returns null for anything that escapes it,
 * so a malformed database value can never delete an arbitrary file.
 */
const safeUploadPath = (storedPath) => {
  if (!storedPath || typeof storedPath !== "string") return null;

  const relative = storedPath.replace(/^\/+/, "");
  if (!relative.startsWith("uploads/")) return null;

  const resolved = path.resolve(UPLOAD_ROOT, relative);
  const uploadsDir = path.resolve(UPLOAD_ROOT, "uploads");

  if (resolved !== uploadsDir && !resolved.startsWith(uploadsDir + path.sep)) {
    return null;
  }
  return resolved;
};

exports.purgeStudent = async (req, res) => {
  const { std_id } = req.params;

  if (!std_id) {
    return res.status(400).json({ success: false, message: "std_id is required" });
  }

  const transaction = await sequelize.transaction();

  try {
    const student = await Student.findByPk(std_id, {
      attributes: ["std_id", "std_cnic", "std_rollno", "user_id"],
      raw: true,
      transaction,
    });

    if (!student) {
      await safeRollback(transaction);
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const user = student.user_id
      ? await User.findByPk(student.user_id, {
          attributes: ["user_id", "user_name", "user_email", "user_profile_photo"],
          raw: true,
          transaction,
        })
      : null;

    const keys = {
      std_id: student.std_id,
      std_cnic: student.std_cnic,
      std_rollno: student.std_rollno,
    };

    // Collect file paths BEFORE deleting the rows that reference them.
    const filesToDelete = [];
    for (const source of FILE_SOURCES) {
      const value = keys[source.key];
      if (value === null || value === undefined || value === "") continue;

      const [rows] = await sequelize.query(
        `SELECT \`${source.column}\` AS filePath FROM \`${source.table}\` WHERE \`${source.key}\` = :value`,
        { replacements: { value }, transaction }
      );
      rows.forEach((row) => filesToDelete.push(row.filePath));
    }
    if (user?.user_profile_photo) filesToDelete.push(user.user_profile_photo);

    // Delete children first, then the student, then the login.
    const deleted = {};
    for (const { table, key } of LINKED_TABLES) {
      const value = keys[key];
      if (value === null || value === undefined || value === "") {
        deleted[table] = 0;
        continue;
      }

      const [, affected] = await sequelize.query(
        `DELETE FROM \`${table}\` WHERE \`${key}\` = :value`,
        { replacements: { value }, transaction }
      );
      deleted[table] = affected ?? 0;
    }

    await Student.destroy({ where: { std_id: student.std_id }, transaction });
    deleted.students = 1;

    if (student.user_id) {
      await User.destroy({ where: { user_id: student.user_id }, transaction });
      deleted.user = 1;
    }

    await transaction.commit();

    // Files last: if this fails the records are already gone, and an orphaned
    // file is far less harmful than an orphaned database row.
    let filesRemoved = 0;
    for (const storedPath of filesToDelete) {
      const absolute = safeUploadPath(storedPath);
      if (!absolute) continue;
      try {
        await fs.unlink(absolute);
        filesRemoved += 1;
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(`[purge] could not delete file ${absolute}:`, error.message);
        }
      }
    }

    console.warn(
      `[purge] student ${student.std_rollno || student.std_id} (${student.std_cnic}) permanently deleted by user ${req.user.id} (${req.user.username}). Rows:`,
      JSON.stringify(deleted),
      `files removed: ${filesRemoved}`
    );

    return res.json({
      success: true,
      message: "Student and all related records permanently deleted",
      student: {
        std_id: student.std_id,
        std_rollno: student.std_rollno,
        std_cnic: student.std_cnic,
        name: user?.user_name || null,
      },
      deleted,
      filesRemoved,
    });
  } catch (error) {
    await safeRollback(transaction);
    console.error("Student purge error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete the student. No changes were made.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
