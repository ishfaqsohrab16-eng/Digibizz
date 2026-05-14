const Topic = require("../models/topicModel");

exports.listTopics = async (req, res) => {
  const topics = await Topic.findAll();
  res.json(topics);
};

exports.getTopic = async (req, res) => {
  const topic = await Topic.findByPk(req.params.id);
  if (!topic) return res.status(404).json({ error: "Topic not found" });
  res.json(topic);
};

exports.createTopic = async (req, res) => {
  const topic = await Topic.create(req.body);
  res.status(201).json(topic);
};

exports.updateTopic = async (req, res) => {
  const topic = await Topic.findByPk(req.params.id);
  if (!topic) return res.status(404).json({ error: "Topic not found" });
  await topic.update(req.body);
  res.json(topic);
};

exports.deleteTopic = async (req, res) => {
  const topic = await Topic.findByPk(req.params.id);
  if (!topic) return res.status(404).json({ error: "Topic not found" });
  await topic.destroy();
  res.json({ success: true });
};
