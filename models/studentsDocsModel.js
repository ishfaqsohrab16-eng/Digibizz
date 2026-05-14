const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db"); // Adjust the path as necessary
const TrainingBatch = require("./trainingBatcheModel"); // Adjust the path as necessary
const StudentsDocsModel = sequelize.define(
  "StudentsDocs",
  {
    doc_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_cnic: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    doc_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    doc_file: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    doc_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      references: {
        model: TrainingBatch,
        key: "tb_id",
      },
    },
    doc_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "students_docs", // Ensure the table name matches your database
    timestamps: false, // Disable Sequelize's default timestamps
  }
);
StudentsDocsModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
module.exports = StudentsDocsModel;
