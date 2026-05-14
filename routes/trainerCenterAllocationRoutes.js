const express = require("express");
const router = express.Router();
const {
  getAllAllocations,
  getAllocation,
  createAllocation,
  updateAllocation,
  deleteAllocation,
} = require("../controllers/trainersCenterAllocationController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
// Define routes
router.post("/center-allocation", isAdminAuthenticated, createAllocation);

module.exports = router;
