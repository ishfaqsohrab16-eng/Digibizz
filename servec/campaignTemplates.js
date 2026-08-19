const { escapeHtml } = require("./emailConfig");
const {
  documentShell,
  detailRows,
  formatDate,
  maskCnic,
} = require("./emailTemplates");

const BRAND = "#4CAF50";
const PORTAL_URL = process.env.LMS_PORTAL_URL || "https://lms.digibizz.gob.pk";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "info@digibizz.gob.pk";

/** Turn a plain-text paragraph into HTML without letting markup through. */
const paragraphHtml = (value) =>
  escapeHtml(value).replace(/\r?\n/g, "<br />");

/**
 * Interview call-up letter, and the reminder variant of the same letter.
 *
 * Sent in bulk by the campaign module, so everything an applicant needs in
 * order to turn up on the right day is in the body itself: the details table
 * is built from their own application data plus the venue and date the
 * campaign carries.
 *
 * The reminder wording is the only difference between the two variants. That
 * matters - a chased applicant receiving a letter that reads as if it were the
 * first one is worse than not chasing them at all.
 *
 * @param {object} data
 * @param {string} data.name                Candidate name
 * @param {string} [data.fatherName]
 * @param {string} [data.cnic]              Masked before display
 * @param {string} [data.phone]
 * @param {number|string} [data.applicationId]
 * @param {string} [data.courseName]        Course applied for
 * @param {string} [data.centerName]        Center applied for
 * @param {string} [data.batchName]
 * @param {string} [data.interviewDate]
 * @param {string} [data.interviewTime]
 * @param {string} [data.reportingTime]
 * @param {string} [data.venue]
 * @param {string} [data.contactPerson]
 * @param {string} [data.contactPhone]
 * @param {string} [data.message]           Extra paragraph from the campaign
 * @param {boolean} [data.isReminder]
 * @param {string} [data.subject]           Overrides the default subject line
 * @returns {{subject: string, text: string, html: string}}
 */
const interviewCall = (data) => {
  const {
    name,
    fatherName,
    cnic,
    phone,
    applicationId,
    courseName,
    centerName,
    batchName,
    interviewDate,
    interviewTime,
    reportingTime,
    venue,
    contactPerson,
    contactPhone,
    message,
    isReminder = false,
    subject: subjectOverride,
  } = data;

  const subject =
    String(subjectOverride || "").trim() ||
    `${isReminder ? "Reminder: " : ""}Interview call${
      courseName ? ` - ${courseName}` : ""
    } | Digibizz Program`;

  const rows = detailRows([
    ["Application No.", applicationId ? `DGB-${applicationId}` : ""],
    ["Applicant Name", name],
    ["Father's Name", fatherName],
    ["CNIC", maskCnic(cnic)],
    ["Contact No.", phone],
    ["Course Applied For", courseName],
    ["Center", centerName],
    ["Training Batch", batchName],
    ["Interview Date", formatDate(interviewDate) || interviewDate],
    ["Interview Time", interviewTime],
    ["Reporting Time", reportingTime],
    ["Venue", venue],
    ["Contact Person", contactPerson],
    ["Contact Number", contactPhone],
  ]);

  const leadHtml = isReminder
    ? "This is a reminder that your interview for the <strong>Digibizz Program</strong> is still pending. Our records show you have not appeared for it yet. Please check the details below and make sure you attend."
    : `Congratulations &mdash; your application to the <strong>Digibizz Program</strong> has been shortlisted${
        courseName ? ` for <strong>${escapeHtml(courseName)}</strong>` : ""
      }. You are invited to appear for an interview at the venue and time shown below.`;

  const leadText = isReminder
    ? "This is a reminder that your interview for the Digibizz Program is still pending. Our records show you have not appeared for it yet. Please check the details below and make sure you attend."
    : `Congratulations - your application to the Digibizz Program has been shortlisted${
        courseName ? ` for ${courseName}` : ""
      }. You are invited to appear for an interview at the venue and time shown below.`;

  const messageBlock = message
    ? `<p style="margin:0 0 18px;padding:12px 14px;background-color:#f5f7f8;border-left:3px solid ${BRAND};color:#37474f;font-size:14px;line-height:1.7;">${paragraphHtml(
        message
      )}</p>`
    : "";

  const html = documentShell(
    subject,
    `
      <p style="margin:0 0 14px;color:#263238;font-size:16px;">Dear <strong>${escapeHtml(
        name || "Applicant"
      )}</strong>,</p>
      <p style="margin:0 0 18px;color:#546e7a;font-size:14px;line-height:1.7;">${leadHtml}</p>

      ${messageBlock}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceff1;border-radius:8px;border-collapse:separate;overflow:hidden;margin-bottom:22px;">
        <tr>
          <td colspan="2" style="background-color:#f5f7f8;padding:12px 14px;color:#37474f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Interview Details</td>
        </tr>
        ${rows}
      </table>

      <p style="margin:0 0 10px;color:#37474f;font-size:14px;font-weight:700;">Please bring with you</p>
      <ul style="margin:0 0 22px;padding-left:20px;color:#546e7a;font-size:14px;line-height:1.8;">
        <li>Your <strong>original CNIC</strong> and one photocopy</li>
        <li>Original <strong>educational documents</strong> and photocopies</li>
        <li>Two recent <strong>passport-size photographs</strong></li>
        <li>A printout of this email, if possible</li>
      </ul>

      <p style="margin:0 0 22px;color:#546e7a;font-size:14px;line-height:1.7;">
        Candidates who do not appear on the scheduled date may not be considered further.
        If you cannot attend, please let us know in advance${
          contactPhone ? ` at ${escapeHtml(contactPhone)}` : ""
        }.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
        <tr>
          <td style="background-color:${BRAND};border-radius:6px;">
            <a href="${escapeHtml(
              PORTAL_URL
            )}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Visit the Digibizz Portal</a>
          </td>
        </tr>
      </table>

      <p style="margin:22px 0 0;color:#546e7a;font-size:14px;line-height:1.7;">
        Best regards,<br /><strong>Admissions Team</strong><br />Digibizz Program
      </p>
    `
  );

  // `null` marks an omitted optional field; "" is a deliberate blank line.
  const text = [
    `Dear ${name || "Applicant"},`,
    "",
    leadText,
    "",
    message ? message : null,
    message ? "" : null,
    "INTERVIEW DETAILS",
    applicationId ? `Application No.: DGB-${applicationId}` : null,
    name ? `Applicant Name: ${name}` : null,
    fatherName ? `Father's Name: ${fatherName}` : null,
    maskCnic(cnic) ? `CNIC: ${maskCnic(cnic)}` : null,
    phone ? `Contact No.: ${phone}` : null,
    courseName ? `Course Applied For: ${courseName}` : null,
    centerName ? `Center: ${centerName}` : null,
    batchName ? `Training Batch: ${batchName}` : null,
    interviewDate
      ? `Interview Date: ${formatDate(interviewDate) || interviewDate}`
      : null,
    interviewTime ? `Interview Time: ${interviewTime}` : null,
    reportingTime ? `Reporting Time: ${reportingTime}` : null,
    venue ? `Venue: ${venue}` : null,
    contactPerson ? `Contact Person: ${contactPerson}` : null,
    contactPhone ? `Contact Number: ${contactPhone}` : null,
    "",
    "PLEASE BRING WITH YOU",
    "- Your original CNIC and one photocopy",
    "- Original educational documents and photocopies",
    "- Two recent passport-size photographs",
    "- A printout of this email, if possible",
    "",
    "Candidates who do not appear on the scheduled date may not be considered further.",
    "",
    `Portal: ${PORTAL_URL}`,
    `Support: ${SUPPORT_EMAIL}`,
    "",
    "Best regards,",
    "Admissions Team - Digibizz Program",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, text, html };
};

module.exports = { interviewCall };
