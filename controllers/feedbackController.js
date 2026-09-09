const StudentsFeedback = require("../models/studentsFeedbackModel");
const Student = require("../models/studentModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const Trainer = require("../models/trainersModel");
const MastterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const Course = require("../models/course");
const Center = require("../models/center");
const {
  isoWeekKey,
  localDateKey,
  monthKey,
  weekLabel,
} = require("../utils/weekKey");
const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await StudentsFeedback.findAll();
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Rating fields, all scored 1-5. */
const RATING_FIELDS = [
  "sf_lecture",
  "sf_queries",
  "sf_knowledge",
  "sf_punctuality",
  "sf_lab_clean",
  "sf_lab_internet",
];

const MAX_COMMENT = 2000;

/**
 * Resolve the student submitting feedback.
 *
 * The student is taken from the authenticated token, never from the request
 * body. `user_id` used to be read straight out of req.body, which meant any
 * signed-in user could file feedback in another student's name simply by
 * changing one field - and, because feedback drives trainer scores, could
 * repeatedly rate a trainer while appearing to be different students.
 */
const resolveStudent = async (req) => {
  const userId = req.user?.id || req.admin?.id;
  if (!userId) return null;
  return Student.findOne({ where: { user_id: userId } });
};

/**
 * Whether the signed-in student may submit feedback right now.
 *
 * Lets the form show the rule up front instead of letting the student fill in
 * the whole thing and only then be told it is not allowed.
 */
const getFeedbackWindow = async (req, res) => {
  try {
    const student = await resolveStudent(req);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }

    const week = isoWeekKey();
    const existing = await StudentsFeedback.findOne({
      where: { std_rollno: student.std_rollno, tb_id: student.tb_id, sf_week: week },
      attributes: ["sf_id", "sf_date"],
    });

    return res.json({
      success: true,
      canSubmit: !existing,
      week,
      weekLabel: weekLabel(),
      submittedOn: existing?.sf_date || null,
      message: existing
        ? `You already submitted feedback for this week (${weekLabel()}). The next one opens on Monday.`
        : `Feedback is open for this week (${weekLabel()}). You can submit on any day, once per week.`,
    });
  } catch (error) {
    console.error("Feedback window error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error checking the feedback window" });
  }
};

/**
 * Submit this week's feedback.
 *
 * Once per week, on any day of that week. The previous rule was Friday-only
 * and lived entirely in the browser, so it was both stricter than intended and
 * trivially bypassed - the API accepted unlimited submissions on any day.
 */
const createFeedback = async (req, res) => {
  try {
    const student = await resolveStudent(req);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }

    // Ratings are validated rather than trusted: the previous version wrote
    // whatever arrived, so a malformed or out-of-range score silently skewed
    // the trainer's averages.
    const ratings = {};
    for (const field of RATING_FIELDS) {
      const value = Number(req.body?.[field]);
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        return res.status(400).json({
          success: false,
          message: `Please give a rating between 1 and 5 for every category`,
          field,
        });
      }
      ratings[field] = value;
    }

    const trainerComment = String(req.body?.sf_trainer_feedback || "").trim();
    const labComment = String(req.body?.sf_lab_feedback || "").trim();

    if (!trainerComment || !labComment) {
      return res.status(400).json({
        success: false,
        message: "Please write both the trainer and the lab feedback",
      });
    }
    if (trainerComment.length > MAX_COMMENT || labComment.length > MAX_COMMENT) {
      return res.status(400).json({
        success: false,
        message: `Keep each comment under ${MAX_COMMENT} characters`,
      });
    }

    // A class can have more than one trainer. Feedback is a single score
    // against a single t_id, so one of them has to be chosen, and there is
    // currently nothing in the form asking the student which they mean.
    //
    // The order is explicit so that the choice is at least the SAME trainer
    // every week rather than whichever row the database happened to return
    // first - otherwise a student's feedback could drift between colleagues
    // and neither score would mean anything. Deciding this properly needs the
    // form to ask.
    const trainer = await TrainerCenterAllocation.findOne({
      where: {
        tb_id: student.tb_id,
        center_id: student.center_id,
        course_id: student.course_id,
      },
      order: [["t_id", "ASC"]],
    });
    if (!trainer) {
      return res.status(400).json({
        success: false,
        message:
          "No trainer is allocated to your batch, center and course yet. Please tell your center manager.",
      });
    }

    const week = isoWeekKey();

    const existing = await StudentsFeedback.findOne({
      where: { std_rollno: student.std_rollno, tb_id: student.tb_id, sf_week: week },
      attributes: ["sf_id", "sf_date"],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You have already submitted feedback for this week (${weekLabel()}). The next one opens on Monday.`,
        submittedOn: existing.sf_date,
      });
    }

    // Dates are set here, not taken from the browser. A client-supplied date
    // let a submission be back- or forward-dated into another week, which is
    // exactly what the once-a-week rule has to prevent.
    const now = new Date();

    const newFeedback = await StudentsFeedback.create({
      std_rollno: student.std_rollno,
      tb_id: student.tb_id,
      center_id: student.center_id,
      t_id: trainer.t_id,
      course_id: student.course_id,
      ...ratings,
      sf_trainer_feedback: trainerComment,
      sf_lab_feedback: labComment,
      sf_date: localDateKey(now),
      sf_month: monthKey(now),
      sf_week: week,
    });

    return res.status(201).json({
      success: true,
      message: "Thank you - your feedback for this week has been recorded.",
      data: newFeedback,
    });
  } catch (error) {
    // The unique index is the real guard: two fast clicks can both pass the
    // check above before either has inserted, and only the database can settle
    // that race. Report it as the same friendly conflict, not a 500.
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: `You have already submitted feedback for this week (${weekLabel()}).`,
      });
    }
    console.error("Create feedback error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving your feedback. Please try again.",
    });
  }
};

const updateFeedback = async (req, res) => {
  const { id } = req.params;
  try {
    // Whitelist. This used to pass req.body straight to update(), so a caller
    // could rewrite std_rollno, t_id, tb_id or sf_week - reassigning someone
    // else's feedback to a different trainer, or freeing up a week slot.
    const editable = {};
    for (const field of [...RATING_FIELDS, "sf_trainer_feedback", "sf_lab_feedback"]) {
      if (req.body?.[field] === undefined) continue;

      if (RATING_FIELDS.includes(field)) {
        const value = Number(req.body[field]);
        if (!Number.isInteger(value) || value < 1 || value > 5) {
          return res.status(400).json({
            success: false,
            message: "Ratings must be between 1 and 5",
            field,
          });
        }
        editable[field] = value;
        continue;
      }

      const text = String(req.body[field]).trim();
      if (text.length > MAX_COMMENT) {
        return res.status(400).json({
          success: false,
          message: `Keep each comment under ${MAX_COMMENT} characters`,
          field,
        });
      }
      editable[field] = text;
    }

    if (Object.keys(editable).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nothing to update" });
    }

    const [updated] = await StudentsFeedback.update(editable, {
      where: { sf_id: id },
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }

    const updatedFeedback = await StudentsFeedback.findByPk(id);
    return res.json({ success: true, data: updatedFeedback });
  } catch (error) {
    console.error("Update feedback error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error updating feedback" });
  }
};

const deleteFeedback = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await StudentsFeedback.destroy({
      where: { sf_id: id },
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }
    return res.json({ success: true, message: "Feedback deleted" });
  } catch (error) {
    console.error("Delete feedback error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error deleting feedback" });
  }
};
const getFeedbackByTbId = async (req, res) => {
  const { tb_id } = req.params;
  try {
    const feedbacks = await StudentsFeedback.findAll({
      where: { tb_id },
    });
    if (feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getAllFeedBacks = async (req, res) => {
  const { user_id, tb_id, userType } = req.params;
  try {
    let condition = {
      tb_id: tb_id,
    };
    if (userType === "MasterTrainer") {
      const masterTrainer = await MastterTrainer.findOne({
        where: { user_id: user_id },
        attributes: ["mt_course_id"], // Explicitly select course_id
      });

      if (!masterTrainer) {
        return res.status(404).json({
          success: false,
          message: "Trainer not found",
        });
      }

      if (!masterTrainer.mt_course_id) {
        return res.status(400).json({
          success: false,
          message: "Course ID not assigned to trainer",
        });
      }

      condition = {
        tb_id: tb_id,
        course_id: masterTrainer.mt_course_id,
      };
    }
    const feedbacks = await StudentsFeedback.findAll({
      where: condition,
      raw: true,
    });

    const feedbacksWithStudentInfo = await Promise.all(
      feedbacks.map(async (feedback) => {
        const student = await Student.findOne({
          where: { std_rollno: feedback.std_rollno },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_name", "user_profile_photo"],
            },
            {
              model: Course,
              as: "courses",
              attributes: ["course_name"],
            },
            {
              model: Center,
              as: "centers",
              attributes: ["center_name"],
            },
          ],
          raw: true,
          nest: true,
        });

        if (!student) {
          return {
            ...feedback,
            studentName: "Unknown",
            studentImage: null,
            centerName: null,
            courseName: null,
          };
        }

        return {
          ...feedback,
          studentName: student.user?.user_name || "Unknown",
          studentImage: student.user?.user_profile_photo || null,
          centerName: student.centers?.center_name || null,
          courseName: student.courses?.course_name || null,
        };
      })
    );

    // Filter out feedbacks with the specified conditions
    const filteredFeedbacks = feedbacksWithStudentInfo.filter(
      (feedback) =>
        feedback.studentName !== "Unknown" &&
        feedback.studentImage !== null &&
        feedback.centerName !== null &&
        feedback.courseName !== null
    );

    res.json({
      success: true,
      data: filteredFeedbacks,
    });
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};
const getFeedbackByTbIdCenterIdCourseId = async (req, res) => {
  const { tb_id, center_id, course_id } = req.params;
  try {
    const feedbacks = await StudentsFeedback.findAll({
      where: { tb_id, center_id, course_id },
    });
    if (feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getFeedbackForTrainer = async (req, res) => {
  const { tb_id, user_id } = req.params;
  try {
    const trainer = await Trainer.findOne({
      where: { user_id: user_id },
    });

    // Without a trainer record there is no id to look feedback up by, and
    // reading one off nothing throws before the query is even built.
    if (!trainer) {
      return res
        .status(404)
        .json({ message: "No trainer record found for this account" });
    }

    const feedbacks = await StudentsFeedback.findAll({
      where: { tb_id, t_id: trainer.t_id },
    });
    if (feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = {
  getAllFeedback,
  getFeedbackWindow,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getFeedbackByTbId,
  getFeedbackByTbIdCenterIdCourseId,
  getFeedbackForTrainer,
  getAllFeedBacks,
};
