const CenterUser = require("../models/centerUsersModel");
const Center = require("../models/center");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const fs = require("fs").promises;
const { sequelize } = require("../config/db");
const { Op } = require("sequelize");
const { undefined } = require("./adminController");
// Register Center User
exports.registerCenterUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) await fs.unlink(req.file.path);
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const {
      user_name,
      user_username,
      user_password,
      user_email,
      center_id,
      cu_status,
    } = req.body;

    // Check for existing user
    const existingAdmin = await User.findOne({
      where: {
        [Op.or]: [{ user_username }, { user_email }],
      },
    });

    if (existingAdmin) {
      if (req.file) await fs.unlink(req.file.path);
      return res.status(400).json({
        message:
          existingAdmin.user_email === user_email
            ? "Email already registered"
            : "Username already taken",
      });
    }

    // Process profile photo
    const user_profile_photo = req.file
      ? `/uploads/user-profiles/${req.file.filename}`
      : null;

    // Create user and admin in transaction
    const result = await sequelize.transaction(async (t) => {
      const newUser = await User.create(
        {
          user_name,
          user_username,
          user_password,
          user_type: "Center Manager",
          user_email,
          user_profile_photo,
          user_status: cu_status,
        },
        { transaction: t }
      );

      const newCenterUser = await CenterUser.create(
        {
          user_id: newUser.user_id,
          center_id,
          cu_status,
        },
        { transaction: t }
      );

      return { newUser, newCenterUser };
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: result.newUser.user_id,
        username: result.newUser.user_username,
        type: result.newUser.user_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Center User registered successfully",
      token,
      centerUser: {
        id: result.newUser.user_id,
        name: user_name,
        username: user_username,
        email: user_email,
        type: result.newUser.user_type,
        status: cu_status,
        profile_photo: user_profile_photo,
      },
    });
  } catch (error) {
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error("Error deleting file:", unlinkError);
      }
    }
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Login Center User
exports.loginCenterUser = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { cu_user, cu_pass } = req.body;

    // Find center user
    const centerUser = await CenterUser.findOne({
      where: { cu_user },
      include: [{ model: Center, as: "center" }],
    });

    if (!centerUser) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await centerUser.validPassword(cu_pass);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check user status
    if (centerUser.cu_status === 0) {
      return res.status(403).json({ message: "User account is inactive" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: centerUser.cu_id,
        username: centerUser.cu_user,
        type: centerUser.cu_type,
        centerId: centerUser.center_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      centerUser: {
        id: centerUser.cu_id,
        username: centerUser.cu_user,
        type: centerUser.cu_type,
        centerId: centerUser.center_id,
        centerName: centerUser.center?.center_name,
      },
    });
  } catch (error) {
    console.error("Center User login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// Get Center User Profile
exports.getCenterUserProfile = async (req, res) => {
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
      c.center_name
    FROM 
      user AS u
    LEFT JOIN 
      centerusers AS ad ON u.user_id = ad.user_id
    LEFT JOIN 
      centers AS c ON ad.center_id = c.center_id
    WHERE 
      u.user_type IN ('Center Manager');
    `;

    const [rows] = await sequelize.query(query);
    if (rows.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No admins found",
        data: [],
      });
    }

    // Transform the data to match the frontend interface
    const transformedData = rows.map((admin) => ({
      user_id: admin.user_id,
      user_name: admin.user_name,
      user_username: admin.user_username,
      user_email: admin.user_email,
      user_type: admin.user_type,
      user_status: admin.user_status,
      user_profile_photo: admin.user_profile_photo,
      center_name: admin.center_name,
    }));

    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error in getCenterUserProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Get Center User Profile by User ID
// Update Center User Profile
exports.getCenterUserProfileByUserId = async (req, res) => {
  const { user_id } = req.params;
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
      c.center_name,
      ad.center_id
    FROM 
      user AS u
    LEFT JOIN 
      centerusers AS ad ON u.user_id = ad.user_id
    LEFT JOIN 
      centers AS c ON ad.center_id = c.center_id
    WHERE 
      u.user_type IN ('Center Manager') AND u.user_id = ${user_id};
    `;

    const [rows] = await sequelize.query(query);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No admins found",
      });
    }

    // Transform the data to match the frontend interface
    const transformedData = rows.map((admin) => ({
      user_id: admin.user_id,
      user_name: admin.user_name,
      user_username: admin.user_username,
      user_email: admin.user_email,
      user_type: admin.user_type,
      user_status: admin.user_status,
      user_profile_photo: admin.user_profile_photo,
      center_name: admin.center_name,
      center_id: admin.center_id,
    }));

    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error in getCenterUserProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
exports.updateCenterUserProfile = async (req, res) => {
  try {
    const centerUserId = req.centerUser.id;
    const { cu_type, cu_status } = req.body;

    const [updatedRowsCount] = await CenterUser.update(
      { cu_type, cu_status },
      { where: { cu_id: centerUserId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Center user not found" });
    }

    const updatedCenterUser = await CenterUser.findByPk(centerUserId, {
      attributes: { exclude: ["cu_pass"] },
    });

    res.json({
      message: "Profile updated successfully",
      centerUser: updatedCenterUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
};
