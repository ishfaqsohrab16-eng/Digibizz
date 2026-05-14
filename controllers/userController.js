const fs = require("fs").promises;
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");

// Login User
exports.loginAdmin = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Invalid input",
        errors: errors.array(),
      });
    }

    const { user_username, user_password } = req.body;

    // Find admin
    const admin = await User.findOne({
      where: {
        user_username,
        user_status: 1, // Only active admins
      },
      attributes: [
        "user_id",
        "user_username",
        "user_password",
        "user_type",
        "user_status",
      ],
    });

    if (!admin) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Check password
    const isMatch = await admin.validPassword(user_password);

    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.user_id,
        username: admin.user_username,
        type: admin.user_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Send response with token and admin data
    res.json({
      status: "success",
      message: "Login successful",
      token,
      admin: {
        id: admin.user_id,
        name: admin.Admin?.admin_name,
        username: admin.user_username,
        type: admin.user_type,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error during login",
    });
  }
};

// Get Admin Profile
exports.getProfile = async (req, res) => {
  try {
    // This would typically come from an auth middleware
    const adminId = req.admin.id;

    const admin = await User.findByPk(adminId, {
      attributes: { exclude: ["user_password"] },
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json(admin);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "Server error fetching profile" });
  }
};
exports.getUserType = async (req, res) => {
  try {
    // Assuming the user object is attached to req by the authentication middleware
    const userType = req.user.type; // or however you store the user type in your user model
    res.json({ userType });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user type", error: error.message });
  }
};
exports.getUserType = async (req, res) => {};
exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    const admin = await User.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Validate current password
    const isMatch = await bcrypt.compare(currentPassword, admin.user_password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash and update the new password
    admin.admin_password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Server error during password change" });
  }
};
