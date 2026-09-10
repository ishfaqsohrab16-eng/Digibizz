const TrainerTopicReport = require("../models/trainerTopicReportModel");

exports.listReports = async (req, res) => {
  try {
    const { trainer_id, tb_id, module_id } = req.query;
    const whereClause = {};
    
    if (trainer_id) whereClause.trainer_id = trainer_id;
    if (tb_id) whereClause.tb_id = tb_id;
    if (module_id) whereClause.module_id = module_id;
    
    const reports = await TrainerTopicReport.findAll({ where: whereClause });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const report = await TrainerTopicReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createReport = async (req, res) => {
  try {
    const report = await TrainerTopicReport.create(req.body);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const report = await TrainerTopicReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    await report.update(req.body);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await TrainerTopicReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    await report.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark topic as completed
exports.markTopicCompleted = async (req, res) => {
  try {
    const { trainer_id, tb_id, course_id, center_id, module_id, topic_id, remarks } = req.body;
    // Check if report already exists
    const existingReport = await TrainerTopicReport.findOne({
      where: {
        trainer_id,
        tb_id,
        course_id,
        center_id,
        module_id,
        topic_id
      }
    });
    
    if (existingReport) {
      // Update existing report
      await existingReport.update({
        mark_done: true,
        remarks: remarks || existingReport.remarks,
        reported_date: new Date()
      });
      res.json(existingReport);
    } else {
      // Create new report
      const newReport = await TrainerTopicReport.create({
        trainer_id,
        tb_id,
        course_id,
        center_id,
        module_id,
        topic_id,
        mark_done: true,
        remarks: remarks || null,
        reported_date: new Date()
      });
      res.status(201).json(newReport);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
