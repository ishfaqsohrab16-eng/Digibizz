const { escapeHtml } = require("./emailConfig");

const BRAND = "#4CAF50";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "info@digibizz.gob.pk";

/** Format a date-ish value as `12 Aug 2026`; returns "" for empty/invalid. */
const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Show only the last 4 digits of a CNIC: `*****-*******-3` */
const maskCnic = (cnic) => {
  const digits = String(cnic || "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `**** **** ${digits.slice(-4)}`;
};

/** Build the rows of the "application summary" table, skipping empty values. */
const detailRows = (rows) =>
  rows
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eceff1;color:#607d8b;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eceff1;color:#263238;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

const documentShell = (title, contentHtml) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef2f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="background-color:${BRAND};padding:24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;">Digibizz Program</h1>
                <p style="margin:6px 0 0;color:#e8f5e9;font-size:13px;">Government of Balochistan &mdash; Digital Skills Training</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:#f5f7f8;padding:18px 24px;text-align:center;color:#90a4ae;font-size:12px;line-height:1.6;">
                <p style="margin:0;">Need help? Write to <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${BRAND};text-decoration:none;">${escapeHtml(SUPPORT_EMAIL)}</a></p>
                <p style="margin:6px 0 0;">This is an automated message &mdash; please do not reply directly.</p>
                <p style="margin:6px 0 0;">&copy; ${new Date().getFullYear()} Digibizz Program. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

/**
 * Personalised "we received your application" email.
 *
 * @param {object} data
 * @param {number|string} data.applicationId  Candidate id, used as tracking no.
 * @param {string} data.name                  Applicant name
 * @param {string} [data.fatherName]
 * @param {string} [data.cnic]
 * @param {string} [data.phone]
 * @param {string} [data.gender]
 * @param {string} data.courseName            Course applied for
 * @param {string} data.centerName            Center applied for
 * @param {string} [data.batchName]
 * @param {string|Date} [data.appliedOn]
 * @returns {{subject: string, text: string, html: string}}
 */
const applicationReceived = (data) => {
  const {
    applicationId,
    name,
    fatherName,
    cnic,
    phone,
    gender,
    courseName,
    centerName,
    batchName,
    appliedOn,
  } = data;

  const firstName = String(name || "Applicant").trim().split(/\s+/)[0];
  const subject = `Application received${courseName ? ` - ${courseName}` : ""} | Digibizz Program`;

  const rows = detailRows([
    ["Application No.", applicationId ? `DGB-${applicationId}` : ""],
    ["Applicant Name", name],
    ["Father's Name", fatherName],
    ["CNIC", maskCnic(cnic)],
    ["Gender", gender],
    ["Contact No.", phone],
    ["Course Applied For", courseName],
    ["Center Applied For", centerName],
    ["Training Batch", batchName],
    ["Applied On", formatDate(appliedOn) || formatDate(new Date())],
  ]);

  const html = documentShell(
    subject,
    `
      <p style="margin:0 0 14px;color:#263238;font-size:16px;">Dear <strong>${escapeHtml(name || "Applicant")}</strong>,</p>
      <p style="margin:0 0 18px;color:#546e7a;font-size:14px;line-height:1.7;">
        Thank you for applying to the <strong>Digibizz Program</strong>. We have successfully received your
        application${courseName ? ` for <strong>${escapeHtml(courseName)}</strong>` : ""}${centerName ? ` at <strong>${escapeHtml(centerName)}</strong>` : ""}.
        Please keep the details below for your records.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceff1;border-radius:8px;border-collapse:separate;overflow:hidden;margin-bottom:22px;">
        <tr>
          <td colspan="2" style="background-color:#f5f7f8;padding:12px 14px;color:#37474f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Application Summary</td>
        </tr>
        ${rows}
      </table>

      <p style="margin:0 0 10px;color:#37474f;font-size:14px;font-weight:700;">What happens next?</p>
      <ol style="margin:0 0 22px;padding-left:20px;color:#546e7a;font-size:14px;line-height:1.8;">
        <li>Our admissions team will review your application.</li>
        <li>Shortlisted candidates are called for an entry test and interview.</li>
        <li>You will be informed of the test/interview schedule by email and SMS on the contact details you provided.</li>
      </ol>

      <p style="margin:0 0 22px;color:#546e7a;font-size:14px;line-height:1.7;">
        Please bring your <strong>original CNIC</strong> and <strong>educational documents</strong> on the day of the test.
        Quote your application number <strong>DGB-${escapeHtml(applicationId || "")}</strong> in any correspondence.
      </p>

      <p style="margin:22px 0 0;color:#546e7a;font-size:14px;line-height:1.7;">
        Best regards,<br /><strong>Admissions Team</strong><br />Digibizz Program
      </p>
    `
  );

  // `null` marks an omitted optional field; "" is a deliberate blank line.
  const text = [
    `Dear ${name || "Applicant"},`,
    "",
    `Thank you for applying to the Digibizz Program. We have successfully received your application${courseName ? ` for ${courseName}` : ""}${centerName ? ` at ${centerName}` : ""}.`,
    "",
    "APPLICATION SUMMARY",
    applicationId ? `Application No.: DGB-${applicationId}` : null,
    name ? `Applicant Name: ${name}` : null,
    fatherName ? `Father's Name: ${fatherName}` : null,
    maskCnic(cnic) ? `CNIC: ${maskCnic(cnic)}` : null,
    gender ? `Gender: ${gender}` : null,
    phone ? `Contact No.: ${phone}` : null,
    courseName ? `Course Applied For: ${courseName}` : null,
    centerName ? `Center Applied For: ${centerName}` : null,
    batchName ? `Training Batch: ${batchName}` : null,
    `Applied On: ${formatDate(appliedOn) || formatDate(new Date())}`,
    "",
    "WHAT HAPPENS NEXT?",
    "1. Our admissions team will review your application.",
    "2. Shortlisted candidates are called for an entry test and interview.",
    "3. You will be informed of the schedule by email and SMS.",
    "",
    "Please bring your original CNIC and educational documents on the day of the test.",
    `Quote your application number DGB-${applicationId || ""} in any correspondence.`,
    "",
    `Support: ${SUPPORT_EMAIL}`,
    "",
    "Best regards,",
    "Admissions Team - Digibizz Program",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, text, html };
};

module.exports = {
  applicationReceived,
  documentShell,
  detailRows,
  formatDate,
  maskCnic,
};
