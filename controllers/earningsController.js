const { validationResult } = require("express-validator");
const fs = require("fs").promises;
const { sequelize } = require("../config/db");
const EarningsModel = require("../models/earningsModel");
const Student = require("../models/studentModel");
const TrainerCenterAllocationModel = require("../models/trainersCenterAllocationModel");
const Trainer = require("../models/trainersModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const User = require("../models/userModel");
const { Op } = require("sequelize");
const { Console } = require("console");
const MasterTrainer = require("../models/masterTrainersModel");

const getMasterTrainerCourseIds = async (userId) => {
  const assignments = await MasterTrainer.findAll({
    where: { user_id: userId },
    attributes: ["mt_course_id"],
  });

  return [
    ...new Set(
      assignments
        .map((assignment) => Number(assignment.mt_course_id))
        .filter(Boolean)
    ),
  ];
};

// Create new earning
exports.createEarning = async (req, res) => {
  try {
    const {
      user_id,
      center_id,
      course_id,
      tb_id,
      earning_platform,
      earning_amount,
      earning_date,
    } = req.body;
    // Check if user exists
    const user = await User.findByPk(user_id, {
      attributes: ["user_name", "user_email", "user_type"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    let std_id = null;
    let t_id = null;

    if (user.user_type === "student") {
      // Retrieve student details
      const student = await Student.findOne({
        where: {
          user_id: user_id,
        },
        attributes: ["std_id", "center_id", "course_id"], // Removed t_id from here
      });
      if (!student) {
        return res.status(404).json({ message: "Student record not found" });
      }

      std_id = student.std_id;

      // Find the trainer associated with the student's center and course
      const trainerAllocation = await TrainerCenterAllocationModel.findOne({
        where: {
          tb_id: tb_id,
          center_id: center_id,
          course_id: course_id,
        },
        attributes: ["t_id"],
      });

      if (!trainerAllocation) {
        return res
          .status(404)
          .json({ message: "Trainer allocation not found" });
      }

      t_id = trainerAllocation.t_id;
    }

    // Handle file upload

    const earning_proof = req.file
      ? `/uploads/earning_proofs/${req.file.filename}`
      : null;

    if (!earning_proof) {
      return res.status(400).json({ message: "Earning proof is required" });
    }
    // Create new earning record
    const newEarning = await EarningsModel.create({
      std_id,
      t_id,
      tb_id,
      center_id,
      course_id,
      earning_platform,
      earning_amount,
      earning_proof,
      earning_date,
    });

    res.status(201).json({
      success: true,
      message: "Earning record created successfully",
      data: newEarning,
    });
  } catch (error) {
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error("Error deleting file:", unlinkError);
      }
    }
    console.error("Error creating earning:", error);
    res
      .status(500)
      .json({ message: "Server error while creating earning record" });
  }
};

// Get all earnings with related data
exports.getAllEarnings = async (req, res) => {
  try {
    const earnings = await EarningsModel.findAll({
      include: [
        {
          model: Student,
          attributes: ["std_name", "std_email"],
        },
        {
          model: Trainer,
          attributes: ["t_name", "t_email"],
        },
        {
          model: TrainingBatch,
          attributes: ["tb_name"],
        },
        {
          model: Center,
          attributes: ["center_name"],
        },
        {
          model: Course,
          attributes: ["course_name"],
        },
      ],
      order: [["earning_date", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching earnings",
    });
  }
};
exports.getEarningsByProfile = async (req, res) => {
  try {
    const { tb_id } = req.params;
    const { user_id } = req.query;
    const student = await Student.findOne({
      where: { user_id },
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const earnings = await EarningsModel.findAll({
      where: { tb_id, std_id: student.std_id },
    });

    res.status(200).json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
  }
};
// Get earnings by student ID
exports.getEarningsByStudent = async (req, res) => {
  try {
    const { std_id } = req.params;

    const earnings = await EarningsModel.findAll({
      where: { std_id },
      include: [
        {
          model: Student,
          attributes: ["std_name", "std_email"],
        },
        {
          model: Course,
          attributes: ["course_name"],
        },
      ],
      order: [["earning_date", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    console.error("Error fetching student earnings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching student earnings",
    });
  }
};

// Update earning status
exports.updateEarningStatus = async (req, res) => {
  try {
    const { earning_id } = req.params;
    const { earning_status } = req.body;

    const earning = await EarningsModel.findByPk(earning_id);

    if (!earning) {
      return res.status(404).json({
        success: false,
        message: "Earning record not found",
      });
    }

    await earning.update({ earning_status });

    res.status(200).json({
      success: true,
      message: "Earning status updated successfully",
      data: earning,
      earningStatus: earning.earning_status,
    });
  } catch (error) {
    console.error("Error updating earning status:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating earning status",
    });
  }
};

// Delete earning record
exports.deleteEarning = async (req, res) => {
  try {
    const { earning_id } = req.params;

    const earning = await EarningsModel.findByPk(earning_id);

    if (!earning) {
      return res.status(404).json({
        success: false,
        message: "Earning record not found",
      });
    }

    // Delete the proof file if it exists
    if (earning.earning_proof) {
      try {
        await fs.unlink(`.${earning.earning_proof}`);
      } catch (unlinkError) {
        console.error("Error deleting proof file:", unlinkError);
      }
    }

    await earning.destroy();

    res.status(200).json({
      success: true,
      message: "Earning record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting earning:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting earning record",
    });
  }
};
const successStoryPlatforms = [
  "99designs",
  "Amazon",
  "Behance",
  "Cross Over",
  "Demand Media",
  "Design Crowd",
  "Dribbble",
  "Facebook",
  "Fiverr",
  "Freelancer",
  "Google Adsense",
  "LinkedIn",
  "Markaz",
  "People Per Hour",
  "Simply Hired",
  "Toptal",
  "Truelancer",
  "Upwork",
  "Other",
];

const fetchEarningsData = async (conditions) => {
  return EarningsModel.findAll({
    where: conditions,
    include: [
      {
        model: Student,
        as: "students",
        required: true,
        attributes: [
          "std_id",
          "user_id",
          "std_gender",
          "center_id",
          "course_id",
          "std_phone",
        ],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["user_name", "user_profile_photo"],
          },
        ],
      },
      {
        model: Center,
        as: "centers",
        attributes: ["center_id", "center_name"],
      },
      {
        model: Course,
        as: "courses",
        attributes: ["course_id", "course_name"],
      },
      {
        model: Trainer,
        as: "trainers",
        attributes: ["t_id", "user_id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["user_name", "user_profile_photo"],
          },
        ],
      },
      {
        model: TrainingBatch,
        as: "training_batches",
        attributes: ["tb_id", "tb_name"],
      },
    ],
    order: [["earning_date", "DESC"]],
  });
};

/**
 * Processes the fetched earnings data to generate various statistics and perform necessary calculations.
 * @param {Array} earningsData - The earnings data to process.
 * @returns {Promise<object>} - Returns a promise that resolves to an object containing processed data.
 */
const processEarningsData = async (earningsData) => {
  const courseEarnings = {};
  const centerEarnings = {};
  const centerSuccessStories = {};
  const trainerStats = {};
  const trainingBatchStats = {};
  const studentTotalEarnings = {};

  await Promise.all(
    earningsData.map(async (earning) => {
      if (earning.earning_status !== 1) return; // Only count approved earnings

      const amount = parseFloat(earning.earning_amount);
      const courseId = earning.students.course_id;
      const centerId = earning.students.center_id;
      const gender = earning.students.std_gender;
      const platform = earning.earning_platform;

      // Fetch the trainer allocation details
      const allocation = await TrainerCenterAllocationModel.findOne({
        where: {
          course_id: courseId,
          center_id: centerId,
          tb_id: earning.tb_id,
        },
        include: [
          {
            model: Trainer,
            as: "trainer",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["user_name", "user_profile_photo"],
              },
            ],
          },
          {
            model: Center,
            as: "center",
            attributes: ["center_id", "center_name"],
          },
          {
            model: Course,
            as: "course",
            attributes: ["course_id", "course_name"],
          },
          {
            model: TrainingBatch,
            as: "training_batch",
            attributes: ["tb_id", "tb_name"],
          },
        ],
      });

      if (!allocation) {
        console.log(
          `No allocation found for course ${courseId} and center ${centerId}`
        );
      }

      const courseName = earning.courses ? earning.courses.course_name : null;
      const centerName = earning.centers ? earning.centers.center_name : null;
      const trainerName = earning.trainers
        ? earning.trainers.user.user_name
        : null;
      const batchName = earning.training_batches
        ? earning.training_batches.tb_name
        : null;
      const studentName = earning.students.user
        ? earning.students.user.user_name
        : null;
      // Course-wise earnings
      courseEarnings[courseName] = (courseEarnings[courseName] || 0) + amount;

      // Center-wise course earnings with gender breakdown
      if (!centerEarnings[centerName]) {
        centerEarnings[centerName] = {
          courses: {},
          total: { male: 0, female: 0, total: 0 },
        };
      }
      if (!centerEarnings[centerName].courses[courseName]) {
        centerEarnings[centerName].courses[courseName] = {
          male: 0,
          female: 0,
          total: 0,
        };
      }

      centerEarnings[centerName].courses[courseName][gender.toLowerCase()] +=
        amount;
      centerEarnings[centerName].courses[courseName].total += amount;
      centerEarnings[centerName].total[gender.toLowerCase()] += amount;
      centerEarnings[centerName].total.total += amount;

      // Success Stories processing (based on earning platform)
      const isSuccessStory = successStoryPlatforms.some((p) =>
        platform.includes(p)
      );
      if (isSuccessStory) {
        if (!studentTotalEarnings[studentName]) {
          studentTotalEarnings[studentName] = {
            earnings: 0,
            successStories: 0,
          };
        }
        studentTotalEarnings[studentName].earnings += amount;
        studentTotalEarnings[studentName].successStories += 1;
      }

      if (isSuccessStory) {
        if (!centerSuccessStories[centerName]) {
          centerSuccessStories[centerName] = {
            courses: {},
            total: 0,
            uniqueStudents: new Set(),
          };
        }

        if (!centerSuccessStories[centerName].courses[courseName]) {
          centerSuccessStories[centerName].courses[courseName] = 0;
        }
        if (
          !centerSuccessStories[centerName].uniqueStudents.has(earning.std_id)
        ) {
          centerSuccessStories[centerName].uniqueStudents.add(earning.std_id);
          centerSuccessStories[centerName].courses[courseName]++;
        }

        centerSuccessStories[centerName].total++;
      }

      // Add to trainer success stories count

      if (trainerName) {
        if (!trainerStats[trainerName]) {
          trainerStats[trainerName] = {
            earnings: 0,
            successStories: 0,
            successOthers: 0,
          };
        }

        // Only count success story if we haven't seen this student before

        trainerStats[trainerName].successStories++;

        trainerStats[trainerName].earnings += amount;
        trainerStats[trainerName].successOthers++;
      } else {
        console.log(
          `Processing success story for trainer: ${trainerName} ANd trainerName${earning.trainers.user.user_name}`
        );
      }

      // Training batch statistics
      if (!trainingBatchStats[batchName]) {
        trainingBatchStats[batchName] = {
          totalEarnings: 0,
          centers: {},
          courses: {},
          maleCount: 0,
          femaleCount: 0,
        };
      }

      if (!trainingBatchStats[batchName].centers[centerName]) {
        trainingBatchStats[batchName].centers[centerName] = {
          courses: {},
          total: { male: 0, female: 0, total: 0 },
        };
      }

      if (
        !trainingBatchStats[batchName].centers[centerName].courses[courseName]
      ) {
        trainingBatchStats[batchName].centers[centerName].courses[courseName] =
          {
            male: 0,
            female: 0,
            total: 0,
          };
      }
      trainingBatchStats[batchName].totalEarnings += amount;
      trainingBatchStats[batchName].centers[centerName].courses[courseName][
        gender.toLowerCase()
      ] += amount;
      trainingBatchStats[batchName].centers[centerName].courses[
        courseName
      ].total += amount;

      trainingBatchStats[batchName].centers[centerName].total[
        gender.toLowerCase()
      ] += amount;
      trainingBatchStats[batchName].centers[centerName].total.total += amount;

      if (gender === "Male") {
        trainingBatchStats[batchName].maleCount++;
      } else if (gender === "Female") {
        trainingBatchStats[batchName].femaleCount++;
      }
    })
  );

  return {
    courseEarnings,
    centerEarnings,
    centerSuccessStories,
    trainerStats,
    trainingBatchStats,
    studentTotalEarnings,
  };
};

const generateResponse = (
  earningsData,
  courseEarnings,
  centerEarnings,
  centerSuccessStories,
  trainerStats,
  trainingBatchStats,
  studentTotalEarnings
) => {
  const totalEarnings = earningsData.reduce((sum, earning) => {
    if (earning.earning_status === 1) {
      return sum + parseFloat(earning.earning_amount);
    }
    return sum;
  }, 0);

  const totalRejectedEarnings = earningsData.reduce((sum, earning) => {
    if (earning.earning_status === 2) {
      return sum + parseFloat(earning.earning_amount);
    }
    return sum;
  }, 0);

  const totalPendingEarnings = earningsData.reduce((sum, earning) => {
    if (earning.earning_status === 0) {
      return sum + parseFloat(earning.earning_amount);
    }
    return sum;
  }, 0);

  const studentStats = {
    totalStudents: 0,
    maleCount: 0,
    femaleCount: 0,
  };

  const uniqueStudents = new Set();

  earningsData.forEach((earning) => {
    if (earning.students && !uniqueStudents.has(earning.students.std_id)) {
      uniqueStudents.add(earning.students.std_id);
      studentStats.totalStudents++;

      if (earning.students.std_gender === "Male") {
        studentStats.maleCount++;
      } else if (earning.students.std_gender === "Female") {
        studentStats.femaleCount++;
      }
    }
  });

  return {
    success: true,
    batchDetails: {
      totalEarnings: totalEarnings.toFixed(2),
      totalRejectedEarnings: totalRejectedEarnings.toFixed(2),
      totalPendingEarnings: totalPendingEarnings.toFixed(2),
      studentStatistics: studentStats,
    },
    courseWiseEarnings: Object.entries(courseEarnings).map(
      ([course, amount]) => ({
        course,
        amount: amount.toFixed(2),
      })
    ),
    centerWiseAnalytics: Object.entries(centerEarnings).map(
      ([center, data]) => ({
        center,
        courseEarnings: Object.entries(data.courses).map(([course, stats]) => ({
          course,
          male: stats.male.toFixed(2),
          female: stats.female.toFixed(2),
          total: stats.total.toFixed(2),
        })),
        totalEarnings: {
          male: data.total.male.toFixed(2),
          female: data.total.female.toFixed(2),
          total: data.total.total.toFixed(2),
        },
      })
    ),
    centerWiseSuccessStories: Object.entries(centerSuccessStories).map(
      ([center, data]) => ({
        center,
        courseSuccesses: Object.entries(data.courses).map(
          ([course, count]) => ({
            course,
            successCount: count,
          })
        ),
        totalSuccesses: data.total,
      })
    ),
    trainerPerformance: Object.entries(trainerStats).map(
      ([trainer, stats]) => ({
        trainer,
        earnings: stats.earnings.toFixed(2),
        successStories: stats.successStories,
        successOthers: stats.successOthers,
      })
    ),
    batchTrainingStats: Object.entries(trainingBatchStats).map(
      ([batch, data]) => ({
        batchName: batch,
        totalEarnings: data.totalEarnings.toFixed(2),
        centerWiseAnalytics: Object.entries(data.centers).map(
          ([center, centerData]) => ({
            center,
            courseEarnings: Object.entries(centerData.courses).map(
              ([course, stats]) => ({
                course,
                male: stats.male.toFixed(2),
                female: stats.female.toFixed(2),
                total: stats.total.toFixed(2),
              })
            ),
            totalEarnings: {
              male: centerData.total.male.toFixed(2),
              female: centerData.total.female.toFixed(2),
              total: centerData.total.total.toFixed(2),
            },
          })
        ),
        courseWiseEarnings: Object.entries(data.courses).map(
          ([course, amount]) => ({
            course,
            amount: amount.toFixed(2),
          })
        ),
        studentStatistics: {
          male: data.maleCount,
          female: data.femaleCount,
          total: data.maleCount + data.femaleCount,
        },
      })
    ),
    // Original earnings data
    earnings: earningsData.map((earning) => {
      const studentName = earning.students?.user?.user_name || "";
      const studentData = studentTotalEarnings[studentName] || {
        earnings: 0,
        successStories: 0,
      };

      return {
        earningId: earning.earning_id,
        studentId: earning.std_id,
        studentName: studentName,
        studentImage: earning.students?.user?.user_profile_photo,
        studentPhone: earning.students?.std_phone,
        gender: earning.students?.std_gender,
        platform: earning.earning_platform,
        amount: earning.earning_amount,
        totalEarnings: studentData.earnings,
        date: earning.earning_date,
        status: earning.earning_status,
        proof: earning.earning_proof,
        centerName: earning.centers.center_name,
        courseName: earning.courses.course_name,
        trainerName: earning.trainers ? earning.trainers.user?.user_name : null,
        trainerImage: earning.trainers
          ? earning.trainers.user?.user_profile_photo
          : null,
        trainingBatchName: earning.training_batches.tb_name,
      };
    }),
  };
};

exports.getEarningsByTrainingBatch = async (req, res) => {
  try {
    const { tb_id, user_id } = req.params;
    let conditions = { tb_id };

    const masterTrainerCourseIds = await getMasterTrainerCourseIds(user_id);

    if (masterTrainerCourseIds.length > 0) {
      conditions = {
        tb_id,
        course_id: { [Op.in]: masterTrainerCourseIds },
      };
    }

    const earningsData = await fetchEarningsData(conditions);

    const {
      courseEarnings,
      centerEarnings,
      centerSuccessStories,
      trainerStats,
      trainingBatchStats,
      studentTotalEarnings, // Add this
    } = await processEarningsData(earningsData);

    const response = generateResponse(
      earningsData,
      courseEarnings,
      centerEarnings,
      centerSuccessStories,
      trainerStats,
      trainingBatchStats,
      studentTotalEarnings
    );

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching batch earnings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching batch earnings",
      error: error.message,
    });
  }
};

exports.getEarningsMasterReport = async (req, res) => {
  try {
    const earningsData = await fetchEarningsData({});

    if (!earningsData.length) {
      return res.status(404).json({
        success: false,
        message: "No earnings found",
      });
    }

    const {
      courseEarnings,
      centerEarnings,
      centerSuccessStories,
      trainerStats,
      trainingBatchStats,
      studentTotalEarnings, // Add this
    } = await processEarningsData(earningsData);

    const response = generateResponse(
      earningsData,
      courseEarnings,
      centerEarnings,
      centerSuccessStories,
      trainerStats,
      trainingBatchStats,
      studentTotalEarnings // Add this parameter
    );

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching master earnings report:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching master earnings report",
      error: error.message,
    });
  }
};
exports.getEarningsByTrainer = async (req, res) => {
   try {
    const { tb_id, user_id } = req.params;
    let conditions = { tb_id };

    const mt = await Trainer.findOne({
      where: { user_id },
    });

    if (mt) {
      const trainerAllocation = await TrainerCenterAllocationModel.findOne({
        where: {
          tb_id,
          t_id: mt.t_id,
        },
      });
      if (!trainerAllocation) {
        return res.status(404).json({
          message: "Trainer allocation not found for this training batch",
        });
      }
      const { center_id, course_id } = trainerAllocation;
      conditions = {
        tb_id,
        center_id,
        course_id,
      };
    }

    const earningsData = await fetchEarningsData(conditions);

    const {
      courseEarnings,
      centerEarnings,
      centerSuccessStories,
      trainerStats,
      trainingBatchStats,
      studentTotalEarnings, // Add this
    } = await processEarningsData(earningsData);

    const response = generateResponse(
      earningsData,
      courseEarnings,
      centerEarnings,
      centerSuccessStories,
      trainerStats,
      trainingBatchStats,
      studentTotalEarnings
    );

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching batch earnings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching batch earnings",
      error: error.message,
    });
  }
};
