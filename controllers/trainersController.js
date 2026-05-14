const Trainer = require("../models/trainersModel");
const Course = require("../models/course");
const Center = require("../models/center");
const MasterTrainer = require("../models/masterTrainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const Student = require("../models/studentModel");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/userModel");
const { sequelize } = require("../config/db");
const CenterModel = require("../models/center");
const TrainingBatch = require("../models/trainingBatcheModel");
const CenterUser = require("../models/centerUsersModel");
// Register Trainer
exports.registerTrainer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      t_cnic,
      user_name,
      user_email,
      user_password,
      user_username,
      t_course_id,
      mt_id,
      dark_mode,
      user_status,
    } = req.body;

    // Check if trainer already exists
    const existingTrainer = await User.findOne({
      where: {
        user_email,
        user_username,
      },
    });
    if (existingTrainer) {
      return res.status(400).json({ message: "Trainer already exists" });
    }
    const user_profile_photo = req.file
      ? `/uploads/user-profiles/${req.file.filename}`
      : null;
    // Create new user
    const newUser = await User.create({
      user_name,
      user_email,
      user_password,
      user_username,
      user_status,
      user_profile_photo,
      user_type: "trainer",
    });
    // Create new trainer
    const newTrainer = await Trainer.create({
      t_cnic,
      t_course_id,
      mt_id,
      user_id: newUser.user_id,
      dark_mode,
      t_added_on: new Date().toISOString().split("T")[0],
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newTrainer.t_id,
        email: newTrainer.t_email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Trainer registered successfully",
      token,
      trainer: {
        id: newTrainer.t_id,
        name: newTrainer.t_name,
        email: newTrainer.t_email,
        courseId: newTrainer.t_course_id,
      },
    });
  } catch (error) {
    console.error("Trainer registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Get Trainer Profile by training batch id
exports.getTrainerProfileForFeedBack = async (req, res) => {
  const { tb_id, center_id, course_id, user_id } = req.params;
  const student = await Student.findOne({
    where: { user_id },
  });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const trainerCenterAllocation = await TrainerCenterAllocation.findOne({
    where: {
      tb_id,
      center_id: student.center_id,
      course_id: student.course_id,
    },
    include: [
      {
        model: Trainer,
        as: "trainer",
        attributes: ["user_id"],
      },
      {
        model: Course,
        as: "course",
        attributes: ["course_full_name"],
      },
      {
        model: Center,
        as: "center",
        attributes: ["center_name"],
      },
    ],
  });
  if (!trainerCenterAllocation) {
    return res.status(404).json({ message: "Trainer not found" });
  }
  const trainer = await Trainer.findOne({
    where: { t_id: trainerCenterAllocation.t_id },
  });
  if (!trainer) {
    return res.status(404).json({ message: "Trainer not found" });
  }
  const user = await User.findOne({
    where: { user_id: trainer.user_id },
  });
  res.json({
    user,
    trainerCenterAllocation,
  });
};

exports.getTrainerProfile = async (req, res) => {
  const { tb_id, center_id, user_id, user_type } = req.query;
  if (!tb_id) {
    return res.status(400).json({
      success: false,
      message: "tb_id is required",
    });
  }
  try {
    let conditions = { tb_id };
    const mt = await MasterTrainer.findOne({
      where: {
        user_id: user_id,
      },
    });
    if (mt) {
      conditions.course_id = mt.mt_course_id;
    }
    if (user_type === "Center Manager") {
      const centerUser = await CenterUser.findOne({
        where: {
          user_id: user_id,
        },
      });
      if (centerUser) {
        conditions.center_id = centerUser.center_id;
      }
    }
    const trainer = await TrainerCenterAllocation.findAll({
      where: conditions,
      include: [
        {
          model: Course,
          as: "course",
          attributes: [
            "course_id",
            "course_name",
            "course_full_name",
            "course_status",
          ],
        },
        {
          model: Center,
          as: "center",
          attributes: ["center_id", "center_name"],
        },
        {
          model: TrainingBatch,
          as: "training_batch",
          attributes: ["tb_id", "tb_name"],
        },
        {
          model: Trainer,
          as: "trainer",
          include: [
            {
              model: User,
              as: "user",
              attributes: [
                "user_id",
                "user_name",
                "user_username",
                "user_email",
                "user_type",
                "user_status",
                "user_profile_photo",
              ],
            },
          ],
        },
      ],
    });
    const transformedData = trainer.map((item) => ({
      user_id: item.trainer.user.user_id,
      user_name: item.trainer.user.user_name,
      user_username: item.trainer.user.user_username,
      user_email: item.trainer.user.user_email,
      user_type: item.trainer.user.user_type,
      user_status: item.trainer.user.user_status,
      user_profile_photo: item.trainer.user.user_profile_photo,
      courseId: item.course.course_id,
      course_name: item.course.course_name,
      course_full_name: item.course.course_full_name,
      course_status: item.course.course_status,
      t_added_on: item.trainer.t_added_on,
      center_name: item.center.center_name,
      t_course_id: item.course_id,
      t_center_id: item.center_id,
      t_id: item.t_id,
      tb_id: item.tb_id,
      tb_name: item.training_batch.tb_name,
    }));
    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error in getTrainerProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getTrainerProfileByUserID = async (req, res) => {
  const { tb_id, center_id, user_id, user_type } = req.query;

  if (!tb_id) {
    return res.status(400).json({
      success: false,
      message: "tb_id is required",
    });
  }

  try {
    const query = `
    SELECT 
        u.user_id,
        u.user_name,
        u.user_username,
        u.user_email,
        u.user_profile_photo,
        u.user_type,
        u.user_status,
        t.t_id,
        t.t_cnic,
        t.t_course_id,
        t.t_added_on,
        c.course_name,
        ce.center_id,
        COALESCE(ce_updated.center_name, ce.center_name) AS center_name,
        c.course_full_name,
        c.course_status,
        mt.mt_course_id,
        mt2.user_name AS master_trainer_name,
        CASE 
            WHEN u2.user_type = 'MasterTrainer' AND u2.user_id = :user_id 
            THEN mt_master.mt_course_id 
            ELSE NULL 
        END AS master_trainer_course_id,
        tca.tb_id,
        tb.tb_name,
        cu.center_id AS manager_center_id
    FROM 
        user AS u
    LEFT JOIN 
        trainers AS t ON u.user_id = t.user_id
    LEFT JOIN 
        courses AS c ON t.t_course_id = c.course_id
    LEFT JOIN
        (SELECT t_id, center_id, tb_id, course_id FROM trainers_center_allocation WHERE tb_id = :tb_id) AS tca 
        ON t.t_id = tca.t_id
    LEFT JOIN 
        centers AS ce ON tca.center_id = ce.center_id
    LEFT JOIN
        mastertrainers AS mt ON t.t_course_id = mt.mt_course_id
    LEFT JOIN
        user AS mt2 ON mt.user_id = mt2.user_id
    LEFT JOIN
        user AS u2 ON u2.user_id = :user_id AND u2.user_type = 'MasterTrainer'
    LEFT JOIN
        mastertrainers AS mt_master ON mt_master.user_id = u2.user_id
    LEFT JOIN
        training_batches AS tb ON tca.tb_id = tb.tb_id
    LEFT JOIN
        centers AS ce_updated ON tca.center_id = ce_updated.center_id
    LEFT JOIN
        courses AS cu_updated ON tca.course_id = cu_updated.course_id
    LEFT JOIN
        centerusers AS cu ON cu.user_id = :user_id AND u2.user_type = 'Center Manager'
    WHERE 
        u.user_type = 'Trainer'
        AND tca.tb_id = :tb_id
        AND t.user_id = :user_id
        ${
          user_type === "MasterTrainer"
            ? "AND t.t_course_id = mt_master.mt_course_id"
            : ""
        }
        ${
          user_type === "Center Manager"
            ? "AND tca.center_id = :center_id AND cu.center_id = :center_id"
            : ""
        };`;

    const [rows] = await sequelize.query(query, {
      replacements: {
        tb_id,
        user_id: user_id || null, // Add user_id to replacements with null fallback
      },
    });

    const transformedData = rows.map((trainer) => ({
      user_id: trainer.user_id,
      user_name: trainer.user_name,
      user_username: trainer.user_username,
      user_email: trainer.user_email,
      user_type: trainer.user_type,
      user_status: trainer.user_status,
      user_profile_photo: trainer.user_profile_photo,
      courseId: trainer.mt_course_id,
      course_name: trainer.course_name,
      course_full_name: trainer.course_full_name,
      course_status: trainer.course_status,
      t_added_on: trainer.t_added_on,
      master_trainer_name: trainer.master_trainer_name,
      center_name: trainer.center_name,
      t_course_id: trainer.course_id,
      t_center_id: trainer.center_id,
      mt_id: trainer.mt_id,
      t_cnic: trainer.t_cnic,
      t_id: trainer.t_id,
      tb_id: trainer.tb_id,
      tb_name: trainer.tb_name,
    }));

    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error in getTrainerProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Trainer Profile
exports.updateTrainerProfile = async (req, res) => {
  try {
    const trainerId = req.trainer.id;
    const { t_name, profile_photo, t_course_id, dark_mode, t_status } =
      req.body;

    const [updatedRowsCount] = await Trainer.update(
      {
        t_name,
        profile_photo,
        t_course_id,
        dark_mode,
        t_status,
      },
      { where: { t_id: trainerId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    const updatedTrainer = await Trainer.findByPk(trainerId, {
      attributes: { exclude: ["t_password"] },
    });

    res.json({
      message: "Profile updated successfully",
      trainer: updatedTrainer,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

exports.getAllTrainers = async (req, res) => {
  try {
    const query = `
    SELECT 
      u.user_id,
      u.user_name,
      u.user_username,
      u.user_email,
      u.user_profile_photo,
      u.user_type,
      u.user_status,
      t.t_id,
      t.t_cnic,
      t.t_added_on
    FROM 
      user AS u
    LEFT JOIN 
      trainers AS t ON u.user_id = t.user_id
    WHERE 
      u.user_type = 'Trainer'
      AND u.user_status = 1
    ORDER BY
      t.t_added_on DESC`;

    const [trainers] = await sequelize.query(query);

    const transformedData = trainers.map((trainer) => ({
      user_id: trainer.user_id,
      user_name: trainer.user_name,
      user_username: trainer.user_username,
      user_email: trainer.user_email,
      user_type: trainer.user_type,
      user_status: trainer.user_status,
      user_profile_photo: trainer.user_profile_photo,
      t_id: trainer.t_id,
      t_cnic: trainer.t_cnic,
      t_added_on: trainer.t_added_on,
    }));

    return res.status(200).json({
      success: true,
      data: transformedData,
      count: transformedData.length,
    });
  } catch (error) {
    console.error("Error in getAllTrainers:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching trainers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
