const Center = require("../models/center");
const { validationResult } = require("express-validator");

// Create Center
exports.createCenter = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      center_name,
      center_location,
      center_type,
      center_medium,
      center_status,
    } = req.body;

    const newCenter = await Center.create({
      center_name,
      center_location,
      center_type,
      center_medium: center_medium || "Physical",
      center_status: center_status || 0,
    });

    res.status(201).json({
      message: "Center created successfully",
      center: newCenter,
    });
  } catch (error) {
    console.error("Center creation error:", error);
    res.status(500).json({ message: "Server error during center creation" });
  }
};

// Get All Centers
exports.getAllCenters = async (req, res) => {
  try {
    const centers = await Center.findAll();
    res.json(centers);
  } catch (error) {
    console.error("Fetching centers error:", error);
    res.status(500).json({ message: "Server error fetching centers" });
  }
};

// Get Center by ID
exports.getCenterById = async (req, res) => {
  try {
    const { id } = req.params;
    const center = await Center.findByPk(id);

    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    res.json(center);
  } catch (error) {
    console.error("Fetching center error:", error);
    res.status(500).json({ message: "Server error fetching center" });
  }
};

// Update Center
exports.updateCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      center_name,
      center_location,
      center_type,
      center_medium,
      center_status,
    } = req.body;

    const [updatedRowsCount] = await Center.update(
      {
        center_name,
        center_location,
        center_type,
        center_medium,
        center_status,
      },
      { where: { center_id: id } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Center not found" });
    }

    const updatedCenter = await Center.findByPk(id);

    res.json({
      message: "Center updated successfully",
      center: updatedCenter,
    });
  } catch (error) {
    console.error("Center update error:", error);
    res.status(500).json({ message: "Server error updating center" });
  }
};

// Delete Center
exports.deleteCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRowCount = await Center.destroy({
      where: { center_id: id },
    });

    if (deletedRowCount === 0) {
      return res.status(404).json({ message: "Center not found" });
    }

    res.json({ message: "Center deleted successfully" });
  } catch (error) {
    console.error("Center deletion error:", error);
    res.status(500).json({ message: "Server error deleting center" });
  }
};
