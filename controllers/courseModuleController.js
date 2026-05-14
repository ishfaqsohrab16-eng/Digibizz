const CourseModule = require("../models/courseModuleModel");
const Topic = require("../models/topicModel");
const Trainer = require("../models/trainersModel");
const TrainerTopicReport = require("../models/trainerTopicReportModel");
const Course = require("../models/course");
const TrainerCenterAlocation = require("../models/trainersCenterAllocationModel");
exports.listModules = async (req, res) => {
  try {
    const { tb_id, course_id, center_id } = req.params;
    const trainerAlocation = await TrainerCenterAlocation.findOne({
      where: { tb_id, course_id, center_id },
      include: [
        { model: Trainer, as: "trainer" }
      ]
    });
    const modules = await CourseModule.findAll({
      where: { course_id },
      include: [
        { model: Course, as: "courseModules" },
        { model: Topic,
          as: "courseTopics",
          include: [
            { 
              model: TrainerTopicReport, 
              as: "trainerReports", 
              where: { tb_id: tb_id, trainer_id: trainerAlocation.trainer.user_id }, 
              required: false, // This makes it a LEFT JOIN instead of INNER JOIN
              include: [{ model: Trainer, as: "trainer" }] 
            }
          ]
        }
      ]
    });  
    res.json({ modules });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
};

exports.getModule = async (req, res) => {
  const module = await CourseModule.findByPk(req.params.id);
  if (!module) return res.status(404).json({ error: "Module not found" });
  res.json(module);
};

exports.createModule = async (req, res) => {
  try {
    let { topics, ...moduleData } = req.body;
    console.log('Module Data:', moduleData, 'Topics:', topics);
    // If topics is a string (from FormData), parse it
    if (topics && typeof topics === 'string') {
      try {
        topics = JSON.parse(topics);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid topics format' });
      }
    }
    
    const module_image_test = req.file
      ? `/uploads/course-modules/${req.file.filename}`
      : null;
    
    // Handle created_by field - set to null if 0 or invalid
    const created_by = moduleData.created_by && moduleData.created_by !== '0' && moduleData.created_by !== 0 
      ? moduleData.created_by 
      : null;
    
    const module = await CourseModule.create({
      course_id: moduleData.course_id,
      title: moduleData.title,
      order_index: moduleData.order_index,
      module_image: module_image_test,
      created_by: created_by,
    });

    let createdTopics = [];
    if (Array.isArray(topics) && topics.length > 0) {
      createdTopics = await Topic.bulkCreate(
        topics.map(t => ({
          ...t,
          module_id: module.id,
        }))
      );
    }
    res.status(201).json({ module, topics: createdTopics });
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({ error: 'Failed to create module' });
  }
};

exports.updateModule = async (req, res) => {
  try {
    let { topics, ...moduleData } = req.body;
    
    // If topics is a string (from FormData), parse it
    if (topics && typeof topics === 'string') {
      try {
        topics = JSON.parse(topics);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid topics format' });
      }
    }

    const module = await CourseModule.findByPk(req.params.id);
    if (!module) return res.status(404).json({ error: "Module not found" });

    // Handle file upload if present
    const module_image = req.file
      ? `/uploads/course-modules/${req.file.filename}`
      : module.module_image; // Keep existing image if no new file

    // Update module
    await module.update({
      ...moduleData,
      module_image: module_image,
    });

    // Handle topics update if provided
    if (Array.isArray(topics)) {
      // Delete existing topics
      await Topic.destroy({ where: { module_id: module.id } });
      
      // Create new topics
      if (topics.length > 0) {
        await Topic.bulkCreate(
          topics.map(t => ({
            ...t,
            module_id: module.id,
          }))
        );
      }
    }

    // Fetch updated module with topics
    const updatedModule = await CourseModule.findByPk(req.params.id, {
      include: [
        { 
          model: Topic,
          as: "courseTopics",
          include: [
            { model: TrainerTopicReport, as: "trainerReports", include: [{ model: Trainer, as: "trainer" }] }
          ]
        }
      ]
    });

    res.json(updatedModule);
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
};

exports.deleteModule = async (req, res) => {
  try {
    const module = await CourseModule.findByPk(req.params.id);
    if (!module) return res.status(404).json({ error: "Module not found" });

    // First, get all topics for this module
    const topics = await Topic.findAll({
      where: { module_id: req.params.id }
    });

    // Delete all trainer topic reports for all topics in this module
    if (topics.length > 0) {
      const topicIds = topics.map(topic => topic.id);
      await TrainerTopicReport.destroy({
        where: { topic_id: topicIds }
      });
    }

    // Delete all topics for this module
    await Topic.destroy({
      where: { module_id: req.params.id }
    });

    // Finally, delete the module itself
    await module.destroy();

    res.json({ success: true, message: "Module and all related data deleted successfully" });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ error: 'Failed to delete module' });
  }
};
