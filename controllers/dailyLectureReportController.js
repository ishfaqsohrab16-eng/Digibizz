const DailyLectureReport = require("../models/dailyLectureReport");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { distinctClasses } = require("../utils/trainerScope");
const MasterTrainerModel = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const CenterDates = require("../models/centersDatesModel");
const { Op } = require("sequelize");
const Holiday = require("../models/holidaysModel");
const Attendance = require("../models/attendanceModel");
const createReport = async (req, res) => {
  try {
    const {
      t_id,
      tb_id,
      dlr_date,
      dlr_title,
      dlr_topics,
      dlr_practical,
      dlr_assignment,
      dlr_challenges,
      dlr_month,
    } = req.body;
    // Validate date format
    const reportDate = new Date(dlr_date);
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Check if date is in the future
    const today = new Date();
    if (reportDate > today) {
      return res
        .status(400)
        .json({ error: "Future dates are not allowed for reports" });
    }

    const trainer = await Trainer.findOne({ where: { user_id: t_id } });
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // One report per class the trainer teaches, not one overall.
    //
    // This used to take findOne on the allocations and file the report against
    // that single center and course. A trainer running online classes for
    // three centers submitted one report and two of those centers showed
    // nothing for the day - the lecture happened, the record did not exist.
    const allocations = await TrainerCenterAllocation.findAll({
      where: { t_id: trainer.t_id, tb_id },
    });

    if (allocations.length === 0) {
      return res
        .status(404)
        .json({ message: "Trainer is not allocated to this batch" });
    }

    // De-duplicated: the same class allocated twice must not produce two
    // identical reports for one lecture.
    const classes = distinctClasses(allocations);

    // Already-submitted classes are skipped rather than failing the whole
    // request: a trainer who added a center mid-batch, or whose first attempt
    // half-succeeded, must still be able to file for the remaining classes.
    const existing = await DailyLectureReport.findAll({
      where: { t_id: trainer.t_id, tb_id, dlr_date },
      attributes: ["center_id", "course_id"],
      raw: true,
    });
    const alreadyFiled = new Set(
      existing.map((row) => `${row.center_id}|${row.course_id}`)
    );

    const pending = classes.filter(
      (allocation) =>
        !alreadyFiled.has(`${allocation.center_id}|${allocation.course_id}`)
    );

    if (pending.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Report for ${dlr_date} is already submitted for all your classes`,
      });
    }

    const created = await DailyLectureReport.bulkCreate(
      pending.map((allocation) => ({
        t_id: trainer.t_id,
        center_id: allocation.center_id,
        course_id: allocation.course_id,
        tb_id,
        dlr_date,
        dlr_title,
        dlr_topics,
        dlr_practical,
        dlr_assignment,
        dlr_challenges,
        dlr_month,
      }))
    );

    const skipped = classes.length - pending.length;

    res.status(201).json({
      success: true,
      message:
        classes.length === 1
          ? `Report created successfully for date ${dlr_date}`
          : `Report filed for ${created.length} of your ${classes.length} classes on ${dlr_date}` +
            (skipped ? ` (${skipped} already submitted)` : ""),
      data: created,
      classes: classes.length,
      skipped,
    });
  } catch (error) {
    console.error("Report creation error:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ error: "A report for this date and batch already exists" });
    }

    res.status(400).json({ error: error.message });
  }
};

const getAllReports = async (req, res) => {
  try {
    const { tb_id, t_id, userType, center_id, course_id } = req.params;
    
    // 1. Set the exact conditions for the specific Center and Course selected
    const conditions = {
      tb_id: tb_id,
      center_id: center_id,
      course_id: course_id,
    };

    // 2. Apply Role-Specific Locks
    if (userType === "trainer") {
      // Trainer: Lock to their specific trainer ID so they only see their own reports
      const trainer = await Trainer.findOne({ where: { user_id: t_id } });
      if (!trainer) {
        return res.status(404).json({ message: "Trainer not found" });
      }
      conditions.t_id = trainer.t_id; 

    } else if (userType === "MasterTrainer") {
      // Master Trainer: Lock to their assigned course directly from the database
      const mt = await MasterTrainerModel.findOne({ where: { user_id: t_id } });
      if (!mt) {
        return res.status(404).json({ message: "Master Trainer not found" });
      }
      // This overrides the course_id to ensure absolute security for the MT's subject
      conditions.course_id = mt.mt_course_id; 
    }
    // Admins have no overrides and will use the exact center_id and course_id passed from the dropdowns

    // 3. Fetch specific Center Dates for progress calculations
    const centerDates = await CenterDates.findOne({
      where: { tb_id: conditions.tb_id, center_id: conditions.center_id },
    });

    if (!centerDates) {
      return res.status(200).json({ 
        message: "This center has no scheduled classes",
        reports: []
      });
    }

    const centerBatchStartDate = centerDates.tb_start;
    const centerBatchEndDate = centerDates.tb_end;

    const startDate = new Date(centerBatchStartDate).toISOString().split("T")[0];
    const today = new Date();
    const tbEndDate = new Date(centerBatchEndDate);
    
    let endDateObj = tbEndDate;
    if (today < tbEndDate) {
      endDateObj = today;
    }
    const endDate = endDateObj.toISOString().split("T")[0];
    
    const workingDays = [];
    let iterDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    while (iterDate <= lastDate) {
      const dayOfWeek = iterDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Weekends
        workingDays.push(iterDate.toISOString().split("T")[0]);
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }

    const holidays = await Holiday.findAll({
      where: {
        tb_id: conditions.tb_id,
        h_date: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["h_date"],
      raw: true,
    });
    
    const holidaySet = new Set(holidays.map((h) => {
      if (typeof h.h_date === 'string' && h.h_date.includes('T')) return h.h_date.split('T')[0];
      return new Date(h.h_date).toISOString().split('T')[0];
    }));

    // 4. Fetch the specific reports!
    const reports = await DailyLectureReport.findAll({
      where: conditions,
      include: [
        {
          model: Center,
          as: "centers",
          attributes: ["center_id", "center_name"],
        },
        {
          model: Course,
          as: "courses",
          attributes: ["course_id", "course_name"],
        },
        {
          model: Trainer,
          as: "trainers",
          attributes: ["t_id", "user_id"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_name", "user_profile_photo"],
            },
          ],
        },
        {
          model: TrainingBatch,
          as: "training_batches",
          attributes: ["tb_id", "tb_name"],
        },
      ],
      order: [["dlr_date", "DESC"]], // Show newest reports first
    });

    const reportDateSet = new Set(reports.map((r) => r.dlr_date));

    const missingReportDates = workingDays.filter(
      (date) => !holidaySet.has(date) && !reportDateSet.has(date)
    );
    const submittedReportDates = workingDays.filter((date) =>
      reportDateSet.has(date)
    );

    if (reports.length > 0) {
      const totalDays = workingDays.filter(date => !holidaySet.has(date)).length;
      const submittedDays = submittedReportDates.length;
      const reportPercentage = totalDays > 0 ? ((submittedDays / totalDays) * 100).toFixed(2) : "0.00";

      const holidayDates = Array.from(holidaySet);

      return res.status(200).json({
        reports,
        reportPercentage: Number(reportPercentage),
        totalDays,
        submittedDays,
        centerBatchStartDate,
        centerBatchEndDate,
        missingReportDates,
        submittedReportDates,
        holidayDates, 
      });
    }

    return res.status(200).json({ reports: [] });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: error.message });
  }
};


const getReportById = async (req, res) => {
  try {
    const report = await DailyLectureReport.findByPk(req.params.id, {
      include: ["trainers", "centers", "courses", "training_batches"],
    });
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateReport = async (req, res) => {
  try {
    const report = await DailyLectureReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    await report.update(req.body);
    res.status(200).json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteReport = async (req, res) => {
  try {
    const report = await DailyLectureReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    await report.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
};
