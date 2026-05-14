const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { auth, authorize } = require("../middleware/auth");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

// Protected routes
router.get("/profile", isAdminAuthenticated, userController.getProfile);
router.get("/type", isAdminAuthenticated, userController.getUserType); // Get user type

module.exports = router;
