const express = require("express");
const router = express.Router();
const holidaysController = require("../controllers/holidaysController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
router.get("/", isAdminAuthenticated, holidaysController.getAllHolidays);

router.get(
  "/:tb_id",
  isAdminAuthenticated,
  holidaysController.getHolidayByTBId
);

router.post("/", isAdminAuthenticated, holidaysController.createHoliday);

router.put("/:id", isAdminAuthenticated, holidaysController.updateHoliday);

router.delete("/:id", isAdminAuthenticated, holidaysController.deleteHoliday);

module.exports = router;
