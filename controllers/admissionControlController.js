const { Op } = require("sequelize");
const db = require("../config/db");
const AdmissionControl = require("../models/admissionControlModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const { safeRollback } = require("../utils/safeRollback");

const normalizeGender = (value = "all") => String(value).toLowerCase();

const normalizeRule = (rule) => ({
  center_id: Number(rule.center_id),
  course_id: Number(rule.course_id),
  allowed_gender: normalizeGender(rule.allowed_gender || "all"),
});

exports.getPublicAdmissionControl = async (req, res) => {
  try {
    const tbId = req.query.tb_id ? Number(req.query.tb_id) : null;
    const whereClause = {};

    if (tbId) {
      whereClause.tb_id = tbId;
    }

    const rules = await AdmissionControl.findAll({
      where: whereClause,
      attributes: ["ac_id", "tb_id", "center_id", "course_id", "allowed_gender"],
      order: [
        ["tb_id", "DESC"],
        ["center_id", "ASC"],
        ["course_id", "ASC"],
      ],
    });

    return res.json({
      success: true,
      totalOpen: rules.length,
      rules,
    });
  } catch (error) {
    console.error("Error fetching public admission controls:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAdmissionControlAdmin = async (req, res) => {
  try {
    const rules = await AdmissionControl.findAll({
      include: [
        { model: TrainingBatch, as: "batch", attributes: ["tb_id", "tb_name"] },
        { model: Center, as: "center", attributes: ["center_id", "center_name"] },
        { model: Course, as: "course", attributes: ["course_id", "course_full_name"] },
      ],
      order: [
        ["tb_id", "DESC"],
        ["center_id", "ASC"],
        ["course_id", "ASC"],
      ],
    });

    return res.json({ success: true, rules });
  } catch (error) {
    console.error("Error fetching admin admission controls:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.saveBatchAdmissionControl = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const tb_id = Number(req.body.tb_id);
    const rules = Array.isArray(req.body.rules) ? req.body.rules : [];

    if (!tb_id) {
      await safeRollback(transaction);
      return res.status(400).json({ success: false, message: "tb_id is required" });
    }

    const normalizedRules = rules.map(normalizeRule).filter((rule) => {
      return (
        Number.isInteger(rule.center_id) &&
        Number.isInteger(rule.course_id) &&
        ["all", "male", "female"].includes(rule.allowed_gender)
      );
    });

    const uniqueKeys = new Set();
    const dedupedRules = [];
    for (const rule of normalizedRules) {
      const key = `${rule.center_id}-${rule.course_id}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        dedupedRules.push(rule);
      }
    }

    await AdmissionControl.destroy({
      where: { tb_id },
      transaction,
    });

    if (dedupedRules.length > 0) {
      await AdmissionControl.bulkCreate(
        dedupedRules.map((rule) => ({
          tb_id,
          center_id: rule.center_id,
          course_id: rule.course_id,
          allowed_gender: rule.allowed_gender,
        })),
        { transaction }
      );
    }

    await transaction.commit();
    return res.json({
      success: true,
      message: "Admission control updated successfully",
      totalOpen: dedupedRules.length,
    });
  } catch (error) {
    await safeRollback(transaction);
    console.error("Error saving admission controls:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.validateAdmissionAvailability = async ({ tb_id, center_id, course_id, gender }) => {
  if (!tb_id || !center_id || !course_id) {
    return { allowed: false, message: "Batch, center and course are required" };
  }

  const normalizedGender = normalizeGender(gender);
  const rule = await AdmissionControl.findOne({
    where: {
      tb_id: Number(tb_id),
      center_id: Number(center_id),
      course_id: Number(course_id),
      allowed_gender: {
        [Op.in]: ["all", normalizedGender],
      },
    },
  });

  if (!rule) {
    return {
      allowed: false,
      message: "Admissions are currently closed for selected batch/center/course or gender.",
    };
  }

  return { allowed: true };
};
