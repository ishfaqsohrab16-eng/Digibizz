const { sequelize } = require("../config/db");
const ActivityLog = require("../models/activityLogModel");
const { getActor, isSuppressed } = require("./auditContext");

/**
 * Records every database change to activity_log, automatically.
 *
 * Implemented as global Sequelize hooks rather than as calls sprinkled through
 * the controllers. Forty controllers would each need remembering, and the one
 * that got missed would be the one someone later needed the history of. A hook
 * on the connection catches every write by construction, including from code
 * written after this.
 *
 * Excluded, per the agreed rules:
 *   - Students. They act on their own records only, and their submissions are
 *     already tracked by the feature that owns them.
 *   - SuperAdmins.
 *   - Anything with no signed-in actor: the campaign dispatcher, schema
 *     guards, seeds. Attributing those to a person would be a lie.
 *
 * Login events are deliberately NOT recorded here. They live in login_logs.
 */

/** Actor roles whose changes are not recorded. */
const EXCLUDED_ROLES = new Set(["student", "superadmin"]);

/**
 * Models that must never be audited.
 *
 * ActivityLog itself would recurse - writing an audit row triggers the hook
 * that writes an audit row. The rest are append-only logs whose own content is
 * already the record.
 */
const EXCLUDED_MODELS = new Set([
  "ActivityLog",
  "LoginLog",
  "EmailCampaignRecipient",
]);

/** Never written into the change log, whatever the model. */
const SENSITIVE_FIELDS = new Set([
  "user_password",
  "password",
  "resetToken",
  "reset_token",
]);

/** Fields that change on every save and say nothing about intent. */
const NOISE_FIELDS = new Set(["updatedAt", "createdAt", "act_on"]);

/**
 * A readable name for the record that changed, so the log says "student Ali
 * Khan" rather than only "Student 42".
 */
const NAME_FIELDS = [
  "user_name",
  "cand_name",
  "std_rollno",
  "t_name",
  "center_name",
  "course_full_name",
  "course_name",
  "tb_name",
  "ec_name",
  "sf_id",
];

const ID_FIELDS = [
  "user_id",
  "std_id",
  "cand_id",
  "t_id",
  "center_id",
  "course_id",
  "tb_id",
];

const truncate = (value, max) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Render a value for the summary; objects and long text are shortened. */
const display = (value) => {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return truncate(JSON.stringify(value), 120);
  return truncate(String(value), 120);
};

/** Best available human label for the affected row. */
const describeSubject = (instance, modelName) => {
  const values = instance?.dataValues || {};

  const name = NAME_FIELDS.map((field) => values[field]).find(
    (value) => value !== undefined && value !== null && String(value).trim() !== ""
  );

  const idField = ID_FIELDS.find((field) => values[field] !== undefined);
  const primary =
    instance?.constructor?.primaryKeyAttribute &&
    values[instance.constructor.primaryKeyAttribute];

  const idPart = primary
    ? `${instance.constructor.primaryKeyAttribute} ${primary}`
    : idField
    ? `${idField} ${values[idField]}`
    : "";

  if (name && idPart) return `${modelName} "${truncate(name, 80)}" (${idPart})`;
  if (name) return `${modelName} "${truncate(name, 80)}"`;
  if (idPart) return `${modelName} (${idPart})`;
  return modelName;
};

/** Field-level before/after for an update, minus noise and secrets. */
const diffFields = (instance) => {
  const changed = typeof instance.changed === "function" ? instance.changed() : [];
  if (!Array.isArray(changed)) return [];

  return changed
    .filter((field) => !NOISE_FIELDS.has(field))
    .map((field) => ({
      field,
      from: SENSITIVE_FIELDS.has(field) ? "(hidden)" : instance._previousDataValues?.[field],
      to: SENSITIVE_FIELDS.has(field) ? "(hidden)" : instance.dataValues?.[field],
    }))
    // A "change" to the same value is a save, not an edit.
    .filter(
      (change) =>
        SENSITIVE_FIELDS.has(change.field) ||
        String(change.from ?? "") !== String(change.to ?? "")
    );
};

/** The paragraph a reader actually sees. */
const buildSummary = ({ actor, action, subject, changes }) => {
  const who = `${actor.name || "Unknown user"} (${actor.type || "unknown role"}, user_id ${actor.id})`;
  const when = new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" });

  if (action === "created") {
    return `${who} created ${subject} on ${when}.`;
  }
  if (action === "deleted") {
    return `${who} deleted ${subject} on ${when}.`;
  }

  if (!changes.length) {
    return `${who} saved ${subject} on ${when} without changing any values.`;
  }

  const parts = changes.map(
    (change) => `${change.field} from ${display(change.from)} to ${display(change.to)}`
  );

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return `${who} updated ${subject} on ${when}, changing ${list}.`;
};

/** Copy scope ids onto the log row when the record happens to carry them. */
const scopeOf = (instance) => {
  const values = instance?.dataValues || {};
  const asId = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  };
  return {
    course_id: asId(values.course_id),
    center_id: asId(values.center_id),
    tb_id: asId(values.tb_id),
  };
};

/** Models excluded regardless of who is acting. */
const shouldSkipModel = (modelName) => EXCLUDED_MODELS.has(modelName);

const shouldSkip = (instance, modelName) => {
  if (isSuppressed()) return true;
  if (shouldSkipModel(modelName)) return true;

  const actor = getActor();
  // No signed-in user: background jobs and startup work, which have no person
  // to attribute the change to.
  if (!actor) return true;
  if (EXCLUDED_ROLES.has(String(actor.type || "").trim().toLowerCase())) return true;

  return false;
};

const record = async (instance, action) => {
  const modelName = instance?.constructor?.name || "Unknown";
  if (shouldSkip(instance, modelName)) return;

  const actor = getActor();

  try {
    const changes = action === "updated" ? diffFields(instance) : [];
    // An update that changed nothing is a no-op save, not history.
    if (action === "updated" && changes.length === 0) return;

    const subject = describeSubject(instance, modelName);
    const summary = buildSummary({ actor, action, subject, changes });
    const scope = scopeOf(instance);
    const primaryKey = instance?.constructor?.primaryKeyAttribute;

    await ActivityLog.create({
      user_id: String(actor.id),
      user_type: actor.type || "unknown",
      act_type: `${modelName}.${action}`,
      act_descrip: truncate(`${action} ${subject}`, 255),
      act_content: truncate(summary, 255),
      act_actor_name: truncate(actor.name || "", 150) || null,
      act_entity: truncate(modelName, 100),
      act_entity_id:
        primaryKey && instance.dataValues?.[primaryKey] !== undefined
          ? String(instance.dataValues[primaryKey])
          : null,
      act_summary: summary,
      act_changes: changes.length ? JSON.stringify(changes) : null,
      act_ip: actor.ip || null,
      ...scope,
    });
  } catch (error) {
    // Auditing must never break the operation it is describing. A lost log
    // line is recoverable; a failed student update because the log table was
    // unavailable is not.
    console.error(
      `[audit] could not record ${action} on ${modelName}:`,
      error?.message || error
    );
  }
};

/**
 * Force per-row hooks on bulk writes.
 *
 * `Model.update({...}, { where })` and `Model.destroy({ where })` fire only the
 * BULK hooks by default, so every controller that uses them - and many do -
 * would change rows with nothing recorded. Setting individualHooks makes
 * Sequelize load the affected rows and fire afterUpdate/afterDestroy for each,
 * which is what produces a field-level record instead of "something changed".
 *
 * Only applied when there is an auditable actor, so background work keeps the
 * cheap bulk path: the campaign dispatcher marking hundreds of recipients must
 * not start loading every row to audit changes nobody asked to track.
 */
const forceIndividualHooks = (options, modelName) => {
  if (shouldSkipModel(modelName)) return;
  if (isSuppressed()) return;

  const actor = getActor();
  if (!actor) return;
  if (EXCLUDED_ROLES.has(String(actor.type || "").trim().toLowerCase())) return;

  options.individualHooks = true;
};

let installed = false;

const install = () => {
  if (installed) return;
  installed = true;

  sequelize.addHook("afterCreate", (instance) => record(instance, "created"));
  sequelize.addHook("afterUpdate", (instance) => record(instance, "updated"));
  sequelize.addHook("afterDestroy", (instance) => record(instance, "deleted"));

  sequelize.addHook("beforeBulkUpdate", (options) =>
    forceIndividualHooks(options, options?.model?.name)
  );
  sequelize.addHook("beforeBulkDestroy", (options) =>
    forceIndividualHooks(options, options?.model?.name)
  );

  console.log("[audit] database change logging enabled");
};

module.exports = {
  install,
  // Exported for tests.
  buildSummary,
  describeSubject,
  diffFields,
  EXCLUDED_ROLES,
  EXCLUDED_MODELS,
};
