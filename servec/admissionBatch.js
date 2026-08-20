/**
 * The batch name applicants are told they are applying for.
 *
 * TEMPORARY, and deliberately a label rather than a database lookup. Intake is
 * for Batch 10 but no Batch 10 row exists in training_batches yet, so the batch
 * resolved from the database still reads "Batch-9". The registration form
 * already overrides the displayed name for the same reason
 * (ADMISSION_BATCH_LABEL in Frontend/src/components/Registration/Registration.tsx),
 * and the emails have to agree with it - an applicant who sees "Batch 10" on
 * the form and "Batch-9" in their confirmation has been given two different
 * answers.
 *
 * Only the label is overridden; every tb_id stays whatever the database says,
 * because candidates.tb_id is a foreign key to training_batches.
 *
 * Set ADMISSION_BATCH_LABEL in the environment to change it without a deploy.
 * To remove this entirely: create Batch-10 under Settings -> Training Batches,
 * open its centers/courses under Admissions -> Admission Control, then drop
 * this module and pass the real tb_name through instead.
 */
const ADMISSION_BATCH_LABEL =
  (process.env.ADMISSION_BATCH_LABEL || "").trim() || "Batch 10";

module.exports = { ADMISSION_BATCH_LABEL };
