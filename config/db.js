const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    charset: "utf8mb4",
    dialectOptions: {
      charset: "utf8mb4",
    },
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_ai_ci",
    },
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Test the database connection
/**
 * Prove the database is reachable.
 *
 * Throws. It used to log and return, which made every caller believe it had
 * succeeded - so the only failure app.js could actually catch was a schema
 * error, which is the one case where taking the server down is wrong.
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    throw error;
  }
};

module.exports = {
  sequelize, // Ensure you're exporting sequelize correctly
  testConnection,
};
