const fs = require("fs").promises;
const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel");
const User = require("../models/userModel");
const CenterUser = require("../models/centerUsersModel");
const Trainer = require("../models/trainersModel");
const MasterTrainer = require("../models/masterTrainersModel");
const Student = require("../models/studentModel");
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { sequelize } = require("../config/db");
const { Op } = require("sequelize");
const crypto = require("crypto");
const TrainersCenterAllocationModel = require("../models/trainersCenterAllocationModel");
const TrainingBatchModel = require("../models/trainingBatcheModel");
const ActivityLogModel = require("../models/activityLogModel");
const sendEmail = require("../servec/emailConfig"); // Import email utility
const {
  getAppSettings,
  updateAppSettings,
} = require("../utils/appSettings");

// In-memory store for verification codes
const verificationCodes = {};

// Register Admin
exports.registerAdmin = async (req, res) => {
  try {
    // Validate input
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
      admin_type,
      admin_status,
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
          user_type: admin_type,
          user_email,
          user_profile_photo,
          user_status: admin_status,
        },
        { transaction: t }
      );

      const newAdmin = await Admin.create(
        {
          user_id: newUser.user_id,
          admin_type,
          admin_status,
        },
        { transaction: t }
      );

      return { newUser, newAdmin };
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: result.newUser.user_id,
        username: result.newUser.user_username,
        type: admin_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      admin: {
        id: result.newUser.user_id,
        name: user_name,
        username: user_username,
        email: user_email,
        type: admin_type,
        status: admin_status,
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

// Login Admin
exports.loginAdmin = async (req, res) => {
  let center_id = 0;
  let course_id = 0;
  let tb_id = 0;
  let std_cnic = "";
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

    const { user_password } = req.body;
    const user_username = req.body.user_username?.trim();
    const trainingBatch = await TrainingBatchModel.findOne({
      order: [["tb_id", "DESC"]],
      attributes: ["tb_id", "tb_name", "tb_start", "tb_end", "tb_status"],
    });

    if (!trainingBatch) {
      return res.status(400).json({
        status: "error",
        message: "No active training batch found",
      });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_username);
    const normalizedLogin = isEmail ? user_username.toLowerCase() : user_username;

    // Find user with validation
    const user = await User.findOne({
      where: {
        ...(isEmail
          ? {
              [Op.and]: [
                sequelize.where(
                  sequelize.fn("LOWER", sequelize.col("user_email")),
                  normalizedLogin
                ),
              ],
            }
          : { user_username: normalizedLogin }),
        user_status: 1,
      },
      attributes: [
        "user_id",
        "user_username",
        "user_name",
        "user_password",
        "user_type",
        "user_status",
        "user_profile_photo",
      ],
    });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Validate password first
    const isMatch = await user.validPassword(user_password);
    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials - Incorrect password",
      });
    }

    const normalizedUserType = user.user_type?.toLowerCase();

    // Handle different user types
    switch (normalizedUserType) {
      case "trainer": {
        const trainer = await Trainer.findOne({
          where: { user_id: user.user_id },
        });

        if (!trainer) {
          return res.status(400).json({
            status: "error",
            message: "Trainer profile not found",
          });
        }

        let trainerAllocation = await TrainersCenterAllocationModel.findOne({
          where: {
            t_id: trainer.t_id,
            tb_id: trainingBatch.tb_id,
          },
        });

        if (!trainerAllocation) {
          // Try to find allocation in previous batch
          trainerAllocation = await TrainersCenterAllocationModel.findOne({
            where: {
              t_id: trainer.t_id,
              tb_id: trainingBatch.tb_id - 1,
            },
          });

          if (!trainerAllocation) {
            return res.status(400).json({
              status: "error",
              message:
                "Trainer is not allocated to any center in current or previous batch",
            });
          }
        }

        center_id = trainerAllocation.center_id;
        course_id = trainerAllocation.course_id;
        tb_id = trainerAllocation.tb_id;
        break;
      }

      case "student": {
        const student = await Student.findOne({
          where: { user_id: user.user_id },
        });

        if (!student) {
          return res.status(400).json({
            status: "error",
            message: "Student profile not found",
          });
        }

        center_id = student.center_id;
        course_id = student.course_id;
        tb_id = student.tb_id;
        std_cnic = student.std_cnic;

        // Generate roll number if not exists
        if (!student.std_rollno || student.std_lms_status === 0) {
          student.std_rollno = generateRollNumber(student.tb_id);
          student.std_lms_status = 1;
          await student.save();
        }
        if (
          student.suspension_reason &&
          student.suspension_reason !== null &&
          student.suspension_reason !== ""
        ) {
          return res.status(403).json({
            success: false,
            message: "Student is suspended: " + student.suspension_reason,
          });
        }
        break;
      }

      case "center manager": {
        const centerUser = await CenterUser.findOne({
          where: { user_id: user.user_id },
        });

        if (!centerUser) {
          return res.status(400).json({
            status: "error",
            message: "Center manager profile not found",
          });
        }

        center_id = centerUser.center_id;
        break;
      }

      case "mastertrainer": {
        const masterTrainer = await MasterTrainer.findOne({
          where: { user_id: user.user_id },
        });

        if (!masterTrainer) {
          return res.status(400).json({
            status: "error",
            message: "Master trainer profile not found",
          });
        }

        course_id = masterTrainer.mt_course_id;
        break;
      }
    }

    // Log activity for trainers and students
    if (["trainer", "student"].includes(normalizedUserType)) {
      await ActivityLogModel.create({
        user_id: user.user_id,
        user_type: normalizedUserType,
        tb_id,
        center_id,
        course_id,
        act_type: "Login",
        act_descrip: "User Logged In",
        act_content: "test",
        act_on: new Date().toLocaleDateString(),
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.user_id,
        username: user.user_username,
        type: user.user_type,
        profile_photo: user.user_profile_photo,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    // Send response
    res.json({
      status: "success",
      message: "Login successful",
      token,
      admin: {
        id: user.user_id,
        name: user.user_name,
        username: user.user_username,
        type: user.user_type,
        profile_photo: user.user_profile_photo,
        center_id,
        course_id,
        tb_id,
        std_cnic,
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
// loginAsSubUser
exports.loginAsSubUser = async (req, res) => {
  try {
    const { user_id, tb_id } = req.params;
    const trainingBatch = await TrainingBatchModel.findOne({
      order: [["tb_id", "DESC"]],
      attributes: ["tb_id", "tb_name", "tb_start", "tb_end", "tb_status"],
    });
    let center_id = 0;
    let course_id = 0;
    let batch_id = tb_id;
    
    let std_cnic = "";
    if (!trainingBatch) {
      return res.status(400).json({
        status: "error",
        message: "No active training batch found",
      });
    }
    const user = await User.findOne({
      where: { user_id },
      attributes: [
        "user_id",
        "user_username",
        "user_name",
        "user_password",
        "user_type",
        "user_status",
        "user_profile_photo",
      ],
    });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Handle different user types
    switch (user.user_type) {
      case "trainer": {
        const trainer = await Trainer.findOne({
          where: { user_id: user.user_id },
        });

        if (!trainer) {
          return res.status(400).json({
            status: "error",
            message: "Trainer profile not found",
          });
        }

        let trainerAllocation = await TrainersCenterAllocationModel.findOne({
          where: {
            t_id: trainer.t_id,
            tb_id: tb_id,
          },
        });

        if (!trainerAllocation) {
          // Try to find allocation in previous batch
          trainerAllocation = await TrainersCenterAllocationModel.findOne({
            where: {
              t_id: trainer.t_id,
              tb_id: trainingBatch.tb_id - 1,
            },
          });

          if (!trainerAllocation) {
            return res.status(400).json({
              status: "error",
              message:
                "Trainer is not allocated to any center in current or previous batch",
            });
          }
        }
        center_id = trainerAllocation.center_id;
        course_id = trainerAllocation.course_id;
        batch_id = trainerAllocation.tb_id;
        break;
      }

      case "student": {
        const student = await Student.findOne({
          where: { user_id: user.user_id },
        });

        if (!student) {
          return res.status(400).json({
            status: "error",
            message: "Student profile not found",
          });
        }

        center_id = student.center_id;
        course_id = student.course_id;
        batch_id = student.tb_id;
        std_cnic = student.std_cnic;
        // Generate roll number if not exists
        if (!student.std_rollno) {
          student.std_rollno = generateRollNumber(student.tb_id);
          await student.save();
        }
        break;
      }

      case "Center Manager": {
        const centerUser = await CenterUser.findOne({
          where: { user_id: user.user_id },
        });

        if (!centerUser) {
          return res.status(400).json({
            status: "error",
            message: "Center manager profile not found",
          });
        }

        center_id = centerUser.center_id;
        break;
      }

      case "MasterTrainer": {
        const masterTrainer = await MasterTrainer.findOne({
          where: { user_id: user.user_id },
        });

        if (!masterTrainer) {
          return res.status(400).json({
            status: "error",
            message: "Master trainer profile not found",
          });
        }

        course_id = masterTrainer.course_id;
        break;
      }
    }

    // Log activity for trainers and students
    if (["trainer", "student"].includes(user.user_type)) {
      await ActivityLogModel.create({
        user_id: user.user_id,
        user_type: user.user_type,
        tb_id: batch_id,
        center_id,
        course_id,
        act_type: "Login",
        act_descrip: "User Logged In",
        act_content: "test",
        act_on: new Date().toLocaleDateString(),
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.user_id,
        username: user.user_username,
        type: user.user_type,
        profile_photo: user.user_profile_photo,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    // Send response
    res.json({
      success: true,
      status: "success",

      message: "Login successful",
      token,
      admin: {
        id: user.user_id,
        name: user.user_name,
        username: user.user_username,
        type: user.user_type,
        profile_photo: user.user_profile_photo,
        center_id,
        course_id,
        tb_id: batch_id,
        std_cnic,
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
// Admin profile controller
exports.getAdminsProfile = async (req, res) => {
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
      u.user_status
    FROM 
      user AS u
    LEFT JOIN 
      admins AS ad ON u.user_id = ad.user_id
    WHERE 
      u.user_type IN ('SuperAdmin', 'ContentAdmin');
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
    }));

    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error in getAdminsProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Update Admin Profile
exports.updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { admin_name, dark_mode } = req.body;

    // Find current admin to get old profile photo
    const currentAdmin = await Admin.findByPk(adminId);
    if (!currentAdmin) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Admin not found" });
    }

    // Prepare update data
    const updateData = {
      admin_name,
      dark_mode,
    };

    // If new file is uploaded, update profile_photo
    if (req.file) {
      // Delete old profile photo if it exists
      if (currentAdmin.profile_photo) {
        const oldPhotoPath = path.join(
          __dirname,
          "..",
          currentAdmin.profile_photo
        );
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updateData.profile_photo = `/uploads/admin-profiles/${req.file.filename}`;
    }

    // Update admin
    const [updatedRowsCount] = await Admin.update(updateData, {
      where: { admin_id: adminId },
    });

    if (updatedRowsCount === 0) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Admin not found" });
    }

    // Fetch updated admin data
    const updatedAdmin = await Admin.findByPk(adminId, {
      attributes: { exclude: ["admin_password"] },
    });

    res.json({
      message: "Profile updated successfully",
      admin: updatedAdmin,
    });
  } catch (error) {
    // Delete uploaded file if update fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error updating profile" });
  }
};
exports.changeUserPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { currentPassword, newPassword, user_id } = req.body;

    const existingUser = await User.findOne({
      where: { user_id: user_id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const student = await Student.findOne({
      where: {
        user_id: user_id,
      },
    });
    if (!existingUser.user_password) {
      existingUser.user_password = newPassword;
      existingUser.user_status = 1;
      await existingUser.save();

      if (student) {
        student.std_rollno = generateRollNumber(student.tb_id);
        student.std_lms_status = 1;
        await student.save();
      }

      return res.json({
        success: true,
        message: "Password set successfully",
      });
    }
    // Verify current password using the validPassword method
    const isValidPassword = await existingUser.validPassword(currentPassword);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message:
          "Current password is incorrect if you forget your password then use forgot password option to reset your password",
      });
    }

    // Don't hash here, let the model hook handle it
    existingUser.user_password = newPassword;
    await existingUser.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password change",
    });
  }
};

exports.resetStudentPasswordByAdmin = async (req, res) => {
  try {
    const { user_id, newPassword } = req.body;

    if (!user_id || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Student and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({
      where: { user_id },
    });

    if (
      !existingUser ||
      existingUser.user_type?.toLowerCase() !== "student"
    ) {
      return res.status(404).json({
        success: false,
        message: "Student user not found",
      });
    }

    const student = await Student.findOne({
      where: { user_id },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const isSuspendedStudent =
      student.std_lms_status === 2 ||
      (student.suspension_reason && student.suspension_reason.trim() !== "");

    existingUser.user_password = newPassword;
    if (!isSuspendedStudent) {
      existingUser.user_status = 1;
      student.std_lms_status = 1;
      await student.save();
    }
    await existingUser.save();

    return res.json({
      success: true,
      message: "Student password reset successfully",
    });
  } catch (error) {
    console.error("Admin student password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during student password reset",
    });
  }
};

exports.getAppSettings = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: getAppSettings(),
    });
  } catch (error) {
    console.error("Get app settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load app settings",
    });
  }
};

exports.updateAppSettings = async (req, res) => {
  try {
    const settings = updateAppSettings({
      requireStudentDocuments: req.body.requireStudentDocuments !== false,
    });

    return res.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Update app settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update app settings",
    });
  }
};

exports.updateProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const { user_username } = req.body;

    if (!user_username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findOne({
      where: { user_username, user_status: 1 },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const user_profile_photo = `/uploads/user-profiles/${req.file.filename}`;

    const oldPhotoPath = user.user_profile_photo;
    await user.update({ user_profile_photo: user_profile_photo });

    if (oldPhotoPath) {
      const fs = require("fs");
      const path = require("path");
      const fullPath = path.join(__dirname, "..", "public", oldPhotoPath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    res.json({
      message: "Profile photo updated successfully",
      newPhotoUrl: user_profile_photo,
    });
  } catch (error) {
    console.error("Profile photo update error:", error);
    res
      .status(500)
      .json({ message: "Server error during profile photo update" });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const user_email = req.body.user_email?.trim().toLowerCase();

    if (!user_email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    const user = await User.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("user_email")),
        user_email
      ),
    });
    if (!user) {
      return res.status(404).json({
        message:
          "User not found. With this email, contact with the support team of digibizz.",
      });
    }

    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();

    // Store the code in memory with expiry
    verificationCodes[user_email] = {
      code: verificationCode,
      expiry: Date.now() + 15 * 60 * 1000, // 15 minutes expiry
    };

    // Send email with the verification code
    await sendEmail(
      user_email,
      "Password Reset Verification Code",
      `Your verification code is \n ${verificationCode}`,
      `<p>Your verification code is <strong>${verificationCode}</strong></p>`
    );

    res.json({ message: "Verification code sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const {
      verification_code,
      new_password,
    } = req.body;
    const user_email = req.body.user_email?.trim().toLowerCase();

    if (!user_email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if the code exists and is valid
    const storedCode = verificationCodes[user_email];
    if (
      !storedCode ||
      storedCode.code !== verification_code ||
      Date.now() > storedCode.expiry
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Find user by email
    const user = await User.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("user_email")),
        user_email
      ),
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const student = await Student.findOne({
      where: { user_id: user.user_id },
    });
    const isSuspendedStudent =
      student &&
      (student.std_lms_status === 2 ||
        (student.suspension_reason &&
          student.suspension_reason.trim() !== ""));

    // Update password
    user.user_password = new_password;
    if (
      user.user_type?.toLowerCase() === "student" &&
      student &&
      !isSuspendedStudent
    ) {
      user.user_status = 1;
      student.std_lms_status = 1;
      await student.save();
    }
    await user.save();

    // Clear the code from memory
    delete verificationCodes[user_email];

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
};

const generateRollNumber = (batchId, randomLength = 7) => {
  const coursePrefix = "D";
  const batchNumber = `B${batchId}`;
  const randomNum = generateRandomNumber(randomLength);
  const checksum = calculateChecksum(randomNum);

  return `${coursePrefix}${batchNumber}-${randomNum}-${checksum}`;
};

const generateRandomNumber = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};
const calculateChecksum = (number) => {
  const sum = number
    .split("")
    .map(Number)
    .reduce((acc, digit, index) => acc + digit * (index + 1), 0);
  return sum % 10;
};
