const express = require("express");
const router = express.Router();
const courseModuleController = require("../controllers/courseModuleController");
const {isAdminAuthenticated} = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadModuleConfig");
// List all modules
router.get("/:tb_id/:course_id/:center_id", isAdminAuthenticated, courseModuleController.listModules);

// Get a single module by id
router.get("/:id", isAdminAuthenticated, courseModuleController.getModule);

// Create a module (with topics and trainer reports)
router.post("/", isAdminAuthenticated, upload.single("module_image"), courseModuleController.createModule);

// Update a module
router.put("/:id", isAdminAuthenticated, upload.single("module_image"), courseModuleController.updateModule);

// Delete a module
router.delete("/:id", isAdminAuthenticated, courseModuleController.deleteModule);

module.exports = router;
