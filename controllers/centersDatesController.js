const CentersDates = require("../models/centersDatesModel");
const { validationResult } = require("express-validator");

// Create Center Date
exports.createCenterDate = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { center_id, tb_id, tb_start, tb_end } = req.body;

    // Check if center date already exists
    const existingCenterDate = await CentersDates.findOne({
      where: { center_id, tb_id },
    });

    if (existingCenterDate) {
      return res.status(400).json({ message: "Center date already exists" });
    }

    // Create new center date
    const newCenterDate = await CentersDates.create({
      center_id,
      tb_id,
      tb_start,
      tb_end,
    });

    res.status(201).json({
      message: "Center date created successfully",
      centerDate: newCenterDate,
    });
  } catch (error) {
    console.error("Center date creation error:", error);
    res
      .status(500)
      .json({ message: "Server error during center date creation" });
  }
};

// Get Center Date
exports.getCenterDate = async (req, res) => {
  try {
    const centerDateId = req.params.id;

    const centerDate = await CentersDates.findByPk(centerDateId, {
      include: ["center", "trainingBatch"],
    });

    if (!centerDate) {
      return res.status(404).json({ message: "Center date not found" });
    }

    res.json(centerDate);
  } catch (error) {
    console.error("Center date fetch error:", error);
    res.status(500).json({ message: "Server error fetching center date" });
  }
};

// Update Center Date
exports.updateCenterDate = async (req, res) => {
  try {
    const centerDateId = req.params.id;
    const { tb_start, tb_end } = req.body;

    const [updatedRowsCount] = await CentersDates.update(
      { tb_start, tb_end },
      { where: { cd_id: centerDateId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Center date not found" });
    }

    const updatedCenterDate = await CentersDates.findByPk(centerDateId);

    res.json({
      message: "Center date updated successfully",
      centerDate: updatedCenterDate,
    });
  } catch (error) {
    console.error("Center date update error:", error);
    res.status(500).json({ message: "Server error updating center date" });
  }
};
