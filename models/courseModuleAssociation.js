const Trainer = require("./trainersModel");
const Course = require("./course");
const CourseModule = require("./courseModuleModel");
const Topic = require("./topicModel");
const TrainerTopicReport = require("./trainerTopicReportModel");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");

TrainerTopicReport.belongsTo(Trainer, { foreignKey: "trainer_id", as: "trainer" });
TrainerTopicReport.belongsTo(Course, { foreignKey: "course_id", as: "course" });
TrainerTopicReport.belongsTo(Center, { foreignKey: "center_id", as: "center" });
TrainerTopicReport.belongsTo(CourseModule, { foreignKey: "module_id", as: "module" });
TrainerTopicReport.belongsTo(Topic, { foreignKey: "topic_id", as: "topic" });
TrainerTopicReport.belongsTo(TrainingBatch, { foreignKey: "tb_id", as: "batch" });

Topic.belongsTo(CourseModule, { foreignKey: "module_id", as: "module" });
CourseModule.hasMany(Topic, { foreignKey: "module_id", as: "courseTopics" });
CourseModule.belongsTo(Course, { foreignKey: "course_id", as: "courseModules" });
Topic.hasMany(TrainerTopicReport, { foreignKey: "topic_id", as: "trainerReports" });
