const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * One row per successful staff login.
 *
 * Students are deliberately excluded: they are the bulk of the user base and
 * already have their logins recorded in activity_logs, so including them would
 * bury the staff access trail this table exists to provide.
 *
 * Name, username and type are snapshotted rather than joined. A login record
 * has to say who signed in *at that moment* - if someone is later renamed or
 * their role changed, a join would silently rewrite the history, which defeats
 * the point of keeping the log.
 */
const LoginLog = sequelize.define(
  "LoginLog",
  {
    ll_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ll_user_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    ll_user_username: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    ll_user_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    /** 45 chars so a full IPv6 address fits. */
    ll_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    /**
     * The untrimmed X-Forwarded-For chain, kept alongside the resolved IP.
     * The header is client-settable, so the raw chain is what makes a spoofed
     * value obvious after the fact instead of just wrong.
     */
    ll_forwarded_for: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ll_user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    /** How the session started - a normal sign-in or an admin impersonation. */
    ll_method: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "password",
    },
    /** Set when an admin signed in as this user; holds the admin's user_id. */
    ll_impersonated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ll_center_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ll_course_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ll_tb_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ll_login_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "login_logs",
    timestamps: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["ll_login_at"] },
      { fields: ["ll_user_type"] },
    ],
  }
);

module.exports = LoginLog;
