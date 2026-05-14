const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/db"); // Correctly import sequelize
const centerController = require("../controllers/centersController");
const { validateCenter } = require("../middleware/centersValidation");
router.get("/centers-with-dates/:tb_id", async (req, res) => {
  const query = `
      SELECT 
        c.center_id,
        c.center_name,
        c.center_location AS center_location,
        c.center_type,
        c.center_medium,
        c.center_status,
        cd.tb_id,
        cd.tb_start,
        cd.tb_end,
        tb.tb_name
      FROM 
        centers AS c
      LEFT JOIN 
        centers_dates AS cd ON c.center_id = cd.center_id
      LEFT JOIN 
        training_batches AS tb ON cd.tb_id = tb.tb_id
    WHERE 
      tb.tb_id = ${req.params.tb_id}
    `;

  try {
    const [rows] = await sequelize.query(query); // Using sequelize.query for raw SQL
    if (rows.length === 0) {
      return res.status(404).json({ error: "No centers found" });
    }
    const formattedCenters = rows.map((center) => ({
      ...center,
      tb_start: center.tb_start.toISOString().split("T")[0], // Format to YYYY-MM-DD
      tb_end: center.tb_end.toISOString().split("T")[0],
    }));
    res.status(200).json({
      success: true,
      formattedCenters: formattedCenters,
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch centers data.", details: error.message });
  }
});

// Create Center
router.post("/", validateCenter, centerController.createCenter);

// Get All Centers
router.get("/", centerController.getAllCenters);

// Get Center by ID
router.get("/:id", centerController.getCenterById);

// Update Center
router.put("/:id", validateCenter, centerController.updateCenter);

// Delete Center
router.delete("/:id", centerController.deleteCenter);
module.exports = router;
