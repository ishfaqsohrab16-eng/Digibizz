const StudentsDocsModel = require("../models/studentsDocsModel"); // Adjust the path as necessary
const StudentsModel = require("../models/studentModel");
const StudentModel = require("../models/studentModel");
const User = require("../models/userModel");
const {
  PASSPORT_DOC_TYPE,
  ensureProfilePhoto,
} = require("../utils/studentProfilePhoto");
// Get all student documents
exports.getAllStudentDocs = async (req, res) => {
  try {
    const studentDocs = await StudentsDocsModel.findAll();
    res.status(200).json(studentDocs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single student document by ID
exports.getStudentDocById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await StudentModel.findOne({ where: { user_id: id } });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const studentDoc = await StudentsDocsModel.findAll({
      where: { std_cnic: student.std_cnic },
    });
    if (studentDoc) {
      res.status(200).json(studentDoc);
    } else {
      res.status(404).json({ message: "Student document not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new student document
exports.createStudentDoc = async (req, res) => {
  try {
    const { std_user_id, doc_type, doc_status, tb_id, doc_date } = req.body;

    const Student = await StudentsModel.findOne({
      where: { user_id: std_user_id },
    });

    if (!Student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Use the actual file path with CNIC directory
    const student_docs = req.file
      ? `/uploads/student_docs/batch-${tb_id}/${Student.std_cnic}/${req.file.filename}`
      : null;
    const checkDoc = await StudentsDocsModel.findOne({
      where: { doc_type, std_cnic: Student.std_cnic },
    });
    if (checkDoc) {
      const deleted = await StudentsDocsModel.destroy({
        where: { doc_type, std_cnic: Student.std_cnic },
      });
    }
    const newStudentDoc = await StudentsDocsModel.create({
      std_cnic: Student.std_cnic,
      doc_type,
      doc_file: student_docs,
      doc_status,
      tb_id,
      doc_date,
    });

    /**
     * A passport photograph just arrived for a student with no usable profile
     * picture, so use it as one - copied, leaving the document itself alone.
     *
     * Doing it here rather than only in the nightly sense of "eventually" is
     * the difference between an avatar that appears the moment the photo is
     * uploaded and one that appears at some point afterwards for no reason
     * the person watching can see.
     *
     * Never allowed to fail the upload. The document is saved and that is
     * what was asked for; a picture that did not get copied is worth a line
     * in the log, not an error page over a successful upload.
     */
    if (doc_type === PASSPORT_DOC_TYPE) {
      try {
        const user = await User.findOne({ where: { user_id: std_user_id } });
        await ensureProfilePhoto(user, Student);
      } catch (error) {
        console.error("[photo] could not adopt the passport photo:", error.message);
      }
    }

    const studentDoc = await StudentsDocsModel.findAll({
      where: { std_cnic: Student.std_cnic },
    });
    res.status(201).json(studentDoc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a student document by ID
exports.updateStudentDoc = async (req, res) => {
  try {
    const { doc_status } = req.body;
    const [updated] = await StudentsDocsModel.update(
      { doc_status },
      { where: { doc_id: req.params.id } }
    );
    if (updated) {
      const updatedStudentDoc = await StudentsDocsModel.findByPk(req.params.id);
      res.status(200).json({
        success: true,
        message: "Student document updated successfully",
        updatedStudentDoc,
      });
    } else {
      res.status(404).json({ message: "Student document not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a student document by ID
exports.deleteStudentDoc = async (req, res) => {
  try {
    const deleted = await StudentsDocsModel.destroy({
      where: { doc_id: req.params.id },
    });
    if (deleted) {
      res.status(204).json({ message: "Student document deleted" });
    } else {
      res.status(404).json({ message: "Student document not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
