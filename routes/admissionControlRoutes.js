const express = require("express");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const {
  getPublicAdmissionControl,
  getAdmissionControlAdmin,
  saveBatchAdmissionControl,
} = require("../controllers/admissionControlController");

const router = express.Router();

router.get("/public", getPublicAdmissionControl);
router.get("/admin", isAdminAuthenticated, getAdmissionControlAdmin);
router.post("/admin/save", isAdminAuthenticated, saveBatchAdmissionControl);

module.exports = router;
