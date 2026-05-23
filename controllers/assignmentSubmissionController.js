const AssignmentSubmission = require("../models/assignmentSubmissionModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Assignment = require("../models/assignmentModel");
const { validationResult } = require("express-validator");
const Student = require("../models/studentModel");
const Trainers = require("../models/trainersModel");
const TrainersAlocation = require("../models/trainersCenterAllocationModel");
const User = require("../models/userModel");
const { Op } = require("sequelize");

// Create Assignment Submission
exports.createAssignmentSubmission = async (req, res) => {
  try {
    const { std_rollno, tb_id, as_id, as_submission_comment } = req.body;
    // Validate required fields
    if (!std_rollno || !tb_id || !as_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }
    const student = await Student.findOne({
      where: { std_rollno },
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student record not found for assignment submission. Please refresh and try again.",
      });
    }
    // Handle file upload
    const as_submission_attachment = req.file
      ? `/uploads/user-assignments/${req.file.filename}`
      : "";
    const assignmentExists = await AssignmentSubmission.findOne({
      where: { std_rollno: std_rollno, tb_id: tb_id, as_id: as_id },
    });
    if (assignmentExists) {
      const existingSubmission = await AssignmentSubmission.destroy({
        where: { std_rollno: std_rollno, tb_id: tb_id, as_id: as_id },
      });
      console.log("Existing submission deleted:", existingSubmission);
    }
    const newSubmission = await AssignmentSubmission.create({
      std_rollno,
      tb_id,
      center_id: student.center_id,
      course_id: student.course_id,
      as_id,
      submitted_on: new Date().toISOString().split("T")[0],
      as_submission_comment,
      as_submission_attachment,
      trainer_comments: "",
      obt_marks: "0",
      as_submission_status: 0,
    });

    res.status(201).json({
      success: true,
      message: "Assignment submitted successfully",
      data: newSubmission,
    });
  } catch (error) {
    console.error("Error in createAssignmentSubmission:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting assignment",
      error: error.message,
    });
  }
};

// Get Assignment Submission by ID
exports.getAssignmentSubmissionById = async (req, res) => {
  try {
    const { as_id, std_rollno } = req.params;

    // Fetch assignment submission with related data
    const assignmentSubmission = await AssignmentSubmission.findOne({
      where: { as_id: as_id, std_rollno: std_rollno },
    });

    res.json({
      success: true,
      message: "Assignment submission fetched successfully",
      assignmentSubmission: assignmentSubmission,
    });
  } catch (error) {
    console.error(
      "Assignment submission fetch error:",
      error.message,
      error.stack
    );
    res.status(500).json({
      message: "Server error fetching assignment submission",
      error: error.message,
    });
  }
};

exports.getAssignmentSubmissionsByBatch = async (req, res) => {
  try {
    const { tb_id, user_id, as_id } = req.params;

    if (!tb_id || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Training batch ID and user ID are required",
      });
    }

    const trainer = await Trainers.findOne({
      where: { user_id: user_id },
    });
    let allocations = [];
    if (trainer) {
      const trainerAllocations = await TrainersAlocation.findAll({
        where: { t_id: trainer.t_id, tb_id: tb_id },
      });

      if (!trainerAllocations.length) {
        return res.status(404).json({
          success: false,
          message: "No trainer allocations found",
        });
      }

      // Create array of center_id/course_id combinations
      allocations = trainerAllocations.map((allocation) => ({
        center_id: allocation.center_id,
        course_id: allocation.course_id,
      }));
   }
    // Get all students for these allocations
    const students = await Student.findAll({
      where: {
        tb_id: tb_id,
        [Op.or]: allocations,
        std_lms_status: { [Op.ne]: 2 }, // Exclude deleted students
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_name"],
        },
        {
          model: Course,
          as: "courses",
          attributes: ["course_name"],
        },
      ],
    });
    // Get all submissions
    const submissions = await AssignmentSubmission.findAll({
      where: { tb_id: tb_id, as_id: as_id },
      include: [
        {
          model: Center,
          as: "Center", 
          attributes: ["center_name"],
        },
        {
          model: Course,
          as: "Course", 
          attributes: ["course_name"],
        },
        {
          model: Assignment,
          as: "Assignment",
          attributes: ["as_title", "as_marks"], 
        },
      ],
    });
    const uniqueSubmissionMap = {};
    submissions.forEach((sub) => {
      if (!uniqueSubmissionMap[sub.std_rollno]) {
        uniqueSubmissionMap[sub.std_rollno] = sub;
      }
    });

    const submittedStudents = students
      .filter((student) => uniqueSubmissionMap[student.std_rollno])
      .map((student) => {
        const submission = uniqueSubmissionMap[student.std_rollno];

        const mappedStudent = {
          std_rollno: student.std_cnic,
          std_name: student.user.user_name,
          center_name: student.centers
            ? student.centers.center_name
            : "Center name missing",
          course_name: student.courses
            ? student.courses.course_name
            : "Course name missing",
          submission_date: submission.submitted_on,
          assignment_title: submission.Assignment
            ? submission.Assignment.as_title
            : "N/A",
          total_marks: submission.Assignment
            ? submission.Assignment.as_marks
            : "N/A",
          obtained_marks: submission.obt_marks,
          status: submission.as_submission_status,
          submission_id: submission.as_submission_id,
          submission_attachment: submission.as_submission_attachment,
          submission_comment: submission.as_submission_comment,
        };

        return mappedStudent;
      });

    const notSubmittedStudents = students
      .filter((student) => !uniqueSubmissionMap[student.std_rollno])
      .map((student) => {
        return {
          std_rollno: student.std_cnic,
          std_name: student.user.user_name,
          center_name: student.centers
            ? student.centers.center_name
            : "Center name missing",
          course_name: student.courses
            ? student.courses.course_name
            : "Course name missing",
        };
      });

    res.status(200).json({
      success: true,
      message: "Assignment submissions fetched successfully",
      data: {
        submitted: submittedStudents,
        notSubmitted: notSubmittedStudents,
        totalStudents: students.length,
        submittedCount: submittedStudents.length,
        pendingCount: notSubmittedStudents.length,
      },
    });
  } catch (error) {
    console.error("Error in getAssignmentSubmissionsByBatch:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching assignment submissions",
      error: error.message,
    });
  }
};

// Update Assignment Submission
exports.updateAssignmentSubmission = async (req, res) => {
  try {
    // Use as_id parameter from the route instead of id
    const submissionId = req.params.as_id;

    // Validate if ID exists
    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Assignment submission ID is required",
      });
    }

    const { trainer_comments, obt_marks, as_submission_status } = req.body;

    // Check if the submission exists
    const existingSubmission = await AssignmentSubmission.findByPk(
      submissionId
    );

    if (!existingSubmission) {
      return res.status(404).json({
        success: false,
        message: "Assignment submission not found",
      });
    }    
      const [updatedRowsCount] = await AssignmentSubmission.update(
        { trainer_comments, obt_marks, as_submission_status },
        { where: { as_submission_id: submissionId } }
      );

      // Fetch the updated assignment submission
      const updatedAssignmentSubmission = await AssignmentSubmission.findByPk(
        submissionId
      );

      return res.json({
        success: true,
        message: "Assignment submission updated successfully",
        assignmentSubmission: updatedAssignmentSubmission,
      });
    
  } catch (error) {
    console.error(
      "Assignment submission update error:",
      error.message,
      error.stack
    );
    res.status(500).json({
      success: false,
      message: "Server error updating assignment submission",
      error: error.message,
    });
  }
};
