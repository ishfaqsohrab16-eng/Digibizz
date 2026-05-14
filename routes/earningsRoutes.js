const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const earningsController = require("../controllers/earningsController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadEarningProof");

// Validation middleware
const earningValidation = [
  body("earning_platform")
    .notEmpty()
    .trim()
    .withMessage("Platform is required"),
  body("earning_amount")
    .isFloat({ min: 0 })
    .withMessage("Amount must be a positive number"),
  body("earning_date").notEmpty().withMessage("Date is required"),
];

// Routes
router.post(
  "/create",
  isAdminAuthenticated,
  upload.single("earning_proofs"),
  earningValidation,
  earningsController.createEarning
);
router.get(
  "/profile/:tb_id",
  isAdminAuthenticated,
  earningsController.getEarningsByProfile
);
router.get("/all", isAdminAuthenticated, earningsController.getAllEarnings);

router.get(
  "/student/:std_id",
  isAdminAuthenticated,
  earningsController.getEarningsByStudent
);

router.patch(
  "/update-status/:earning_id",
  isAdminAuthenticated,
  body("earning_status").isIn([0, 1, 2]).withMessage("Invalid status"),
  earningsController.updateEarningStatus
);

router.delete(
  "/:earning_id",
  isAdminAuthenticated,
  earningsController.deleteEarning
);
router.get(
  "/earning-report/:tb_id/:user_id",
  isAdminAuthenticated,
  earningsController.getEarningsByTrainingBatch
);
router.get(
  "/earning-master-report",
  isAdminAuthenticated,
  earningsController.getEarningsMasterReport
);
router.get(
  "/earning-report-trainer/:tb_id/:user_id",
  isAdminAuthenticated,
  earningsController.getEarningsByTrainer
);
module.exports = router;
