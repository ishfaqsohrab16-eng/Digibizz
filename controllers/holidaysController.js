const { Op } = require("sequelize");
const HolidaysModel = require("../models/holidaysModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
// Get all holidays
exports.getAllHolidays = async (req, res) => {
  try {
    const holidays = await HolidaysModel.findAll({
      include: [{ model: TrainingBatch, as: "training_batches" }],
    });
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single holiday by ID
exports.getHolidayByTBId = async (req, res) => {
  try {
    const { tb_id } = req.params;
    const { center_id } = req.query;

    // This used to be a hardcoded `center_id: 6` that ignored tb_id entirely,
    // so every center was served center 6's holidays.
    const where = { tb_id };
    if (center_id && String(center_id) !== "0") {
      // Global holidays (center_id NULL) apply everywhere, plus this center's.
      where[Op.or] = [{ center_id: null }, { center_id }];
    }

    const holiday = await HolidaysModel.findAll({
      where,
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
      ],
    });
    if (holiday) {
      res.status(200).json(holiday);
    } else {
      res.status(404).json({ message: "Holiday not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new holiday
exports.createHoliday = async (req, res) => {
  try {
    const { h_date, h_reason, tb_id } = req.body;
    // `center_id` was destructured as a const and then reassigned, which threw
    // "Assignment to constant variable" every time a global holiday was added.
    let { center_id } = req.body;
    if (center_id === "null" || center_id === "" || center_id === undefined) {
      center_id = null; // null => holiday applies to every center
    }
    const newHoliday = await HolidaysModel.create({
      h_date,
      h_reason,
      tb_id,
      center_id,
    });
    res.status(201).json(newHoliday);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a holiday by ID
exports.updateHoliday = async (req, res) => {
  try {
    const { h_date, h_reason, tb_id } = req.body;
    const [updated] = await HolidaysModel.update(
      { h_date, h_reason, tb_id },
      { where: { h_id: req.params.id } }
    );
    if (updated) {
      const updatedHoliday = await HolidaysModel.findByPk(req.params.id);
      res.status(200).json(updatedHoliday);
    } else {
      res.status(404).json({ message: "Holiday not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a holiday by ID
exports.deleteHoliday = async (req, res) => {
  try {
    const deleted = await HolidaysModel.destroy({
      where: { h_id: req.params.id },
    });
    if (deleted) {
      res.status(204).json({ message: "Holiday deleted" });
    } else {
      res.status(404).json({ message: "Holiday not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
