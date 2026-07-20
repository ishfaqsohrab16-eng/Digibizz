const MasterTrainer = require("../models/masterTrainersModel");
const Course = require("../models/course");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/userModel");
const { sequelize } = require("../config/db");
const { Op } = require("sequelize");
// Register Master Trainer
exports.registerMasterTrainer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const {
      user_name,
      user_email,
      user_password,
      user_username,
      mt_course_id,
      mt_dark_mode,
      user_status,
    } = req.body;

    // Check if master trainer already exists
    const existingMasterTrainer = await User.findOne({
      where: { user_email },
    });

    if (existingMasterTrainer) {
      return res.status(400).json({ message: "Master Trainer already exists" });
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
      user_status: user_status || 1,
      user_type: "MasterTrainer",
      user_profile_photo,
    });
    // Create new master trainer
    const newMasterTrainer = await MasterTrainer.create({
      mt_course_id,
      mt_added_on: new Date().toISOString().split("T")[0],
      mt_dark_mode: mt_dark_mode || 0,
      user_id: newUser.user_id, // Add this association
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newMasterTrainer.mt_id,
        email: newUser.mt_email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Master Trainer registered successfully",
      token,
      masterTrainer: {
        id: newMasterTrainer.mt_id,
        name: newUser.user_name,
        email: newUser.mt_email,
        user_username: newUser.user_username,
        courseId: newMasterTrainer.mt_course_id,
      },
    });
  } catch (error) {
    console.error("Master Trainer registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Get Master Trainer Profile
exports.getMasterTrainerProfile = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.user_id,
        u.user_name,
        u.user_username,
        u.user_email,
        u.user_profile_photo,
        u.user_password,
        u.user_type,
        u.user_status,
        mt.mt_course_id,
        mt.mt_id,
        mt.mt_dark_mode,
        mt.mt_added_on,
        c.course_name,
        c.course_full_name,
        c.course_status
      FROM 
        user AS u
      LEFT JOIN 
        mastertrainers AS mt ON u.user_id = mt.user_id
      LEFT JOIN 
        courses AS c ON mt.mt_course_id = c.course_id
      WHERE 
        u.user_type = 'MasterTrainer'`;

    const [rows] = await sequelize.query(query);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No admins found",
      });
    }

    // Master trainers can have multiple rows, one per assigned course.
    // Return one user row with all assigned courses so the UI does not show only one course.
    const trainersByUser = new Map();

    rows.forEach((trainer) => {
      const existing = trainersByUser.get(trainer.user_id);
      const courseIds = trainer.mt_course_id ? [trainer.mt_course_id] : [];
      const courseNames = trainer.course_name ? [trainer.course_name] : [];

      if (!existing) {
        trainersByUser.set(trainer.user_id, {
          user_id: trainer.user_id,
          user_name: trainer.user_name,
          user_username: trainer.user_username,
          user_email: trainer.user_email,
          user_type: trainer.user_type,
          user_status: trainer.user_status,
          user_profile_photo: trainer.user_profile_photo,
          courseId: trainer.mt_course_id,
          courseIds,
          course_name: courseNames.join(", "),
          course_names: courseNames,
          mt_added_on: trainer.mt_added_on,
          mt_id: trainer.mt_id,
        });
        return;
      }

      if (trainer.mt_course_id && !existing.courseIds.includes(trainer.mt_course_id)) {
        existing.courseIds.push(trainer.mt_course_id);
      }

      if (trainer.course_name && !existing.course_names.includes(trainer.course_name)) {
        existing.course_names.push(trainer.course_name);
        existing.course_name = existing.course_names.join(", ");
      }
    });

    const transformedData = Array.from(trainersByUser.values());

    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error in getMasterTrainerProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Master Trainer Profile
exports.updateMasterTrainerProfile = async (req, res) => {
  try {
    const masterTrainerId = req.masterTrainer.id;
    const { mt_name, profile_photo, mt_course_id, mt_dark_mode, mt_status } =
      req.body;

    const [updatedRowsCount] = await MasterTrainer.update(
      {
        mt_name,
        profile_photo,
        mt_course_id,
        mt_dark_mode,
        mt_status,
      },
      { where: { mt_id: masterTrainerId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Master Trainer not found" });
    }

    const updatedMasterTrainer = await MasterTrainer.findByPk(masterTrainerId, {
      attributes: { exclude: ["mt_password"] },
    });

    res.json({
      message: "Profile updated successfully",
      masterTrainer: updatedMasterTrainer,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
};
