const express = require("express");
const router = express.Router();
const {
  getAllProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
} = require("../controllers/freelancingController");

router.get("/:user_id", getAllProfiles);
router.post("/", createProfile);
router.put("/:id", updateProfile);
router.delete("/:id", deleteProfile);

module.exports = router;
