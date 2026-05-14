const StudentsFreelancing = require("../models/studentsFreelancingModel");
const Student = require("../models/studentModel");
const getAllProfiles = async (req, res) => {
  try {
    const { user_id } = req.params;
    const student = await Student.findOne({
      where: { user_id: user_id },
    });
    const profiles = await StudentsFreelancing.findAll({
      where: { std_cnic: student.std_cnic },
    });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProfile = async (req, res) => {
  try {
    const { user_id, ep_name, sfp_link, sfp_status, sfp_date } = req.body;
    const student = await Student.findOne({
      where: { user_id: user_id },
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const existingProfile = await StudentsFreelancing.findOne({
      where: { std_cnic: student.std_cnic, ep_name },
    });
    if (existingProfile) {
      const deleted = await StudentsFreelancing.destroy({
        where: { std_cnic: student.std_cnic, ep_name },
      });
    }
    const newProfile = await StudentsFreelancing.create({
      std_cnic: student.std_cnic,
      ep_name,
      sfp_link,
      sfp_status,
      sfp_date,
    });
    const studentProfile = await StudentsFreelancing.findAll({
      where: { std_cnic: student.std_cnic },
    });
    res.status(201).json(studentProfile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  const { id } = req.params;
  const { sfp_status } = req.body;
  try {
    // Convert status to number for comparison if needed
    const statusNum = Number(sfp_status);

    const updated = await StudentsFreelancing.update(
      { sfp_status: statusNum },
      {
        where: { sfp_id: id },
      }
    );
    if (updated[0] > 0) {
      const updatedProfile = await StudentsFreelancing.findByPk(id);
      return res.json({
        success: true,
        message: "Profile updated successfully",
        updatedProfile,
      });
    }
    return res.status(404).json({ message: "Profile not found" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const deleteProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await StudentsFreelancing.destroy({
      where: { sfp_id: id },
    });
    if (deleted) {
      res.json({ message: "Profile deleted" });
    } else {
      res.status(404).json({ message: "Profile not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
};
