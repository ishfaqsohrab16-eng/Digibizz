const { escapeHtml } = require("./emailConfig");
const {
  documentShell,
  detailRows,
  formatDate,
  maskCnic,
} = require("./emailTemplates");

const BRAND = "#4CAF50";
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
/** Matches {{token}}, tolerating inner whitespace such as {{ name }}. */
const TOKEN_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Merge tokens usable inside a campaign's custom HTML.
 *
 * Keyed by the token name written as {{name}}; the value is pulled from the
 * same data object the built-in letter uses, so a custom email has access to
 * exactly the same fields and nothing more.
 */
const MERGE_FIELDS = {
  name: (d) => d.name,
  father_name: (d) => d.fatherName,
  cnic: (d) => maskCnic(d.cnic),
  phone: (d) => d.phone,
  course: (d) => d.courseName,
  center: (d) => d.centerName,
  batch: (d) => d.batchName,
  interview_date: (d) => formatDate(d.interviewDate) || d.interviewDate,
  interview_time: (d) => d.interviewTime,
  reporting_time: (d) => d.reportingTime,
  venue: (d) => d.venue,
  contact_person: (d) => d.contactPerson,
  contact_phone: (d) => d.contactPhone,
  message: (d) => d.message,
};

/** The token names, surfaced as help text on the compose screen. */
const MERGE_TOKENS = Object.keys(MERGE_FIELDS);

/**
 * Substitute {{tokens}} in author-written HTML.
 *
 * Values are HTML-escaped on the way in. The markup itself is trusted - only a
 * SuperAdmin can author it - but the candidate data merged into it is not: a
 * name containing an angle bracket would otherwise break the layout, and a
 * pasted value could inject markup the author never wrote.
 *
 * An unknown token becomes an empty string rather than staying visible, so a
 * typo degrades to a blank instead of mailing "{{nmae}}" to two hundred people.
 */
const applyMergeTokens = (html, data) =>
  String(html ?? "").replace(TOKEN_PATTERN, (_, token) => {
    const key = String(token).toLowerCase();
    const resolve = MERGE_FIELDS[key];
    return resolve ? escapeHtml(resolve(data) ?? "") : "";
  });

/**
 * Plain-text alternative for a custom HTML email.
 *
 * Every message needs one: a text-only client shown raw markup is unreadable,
 * and a missing text part is itself a spam signal.
 */
const customHtmlToText = (html) =>
  String(html || "")
    // Comments first: an author's notes to themselves are invisible in the
    // HTML part but would otherwise be stripped to bare text and shown to the
    // recipient as the opening lines of the message.
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    // A cell break is a space, not a newline: email layouts put a label and
    // its value in two cells of one row, and breaking between them would turn
    // "Venue  Main Campus" into two disconnected lines in the text version.
    .replace(/<\/(td|th)>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/[ \t]{2,}/g, " ")
    // Source indentation becomes a leading space on nearly every line once the
    // tags are gone, which reads as ragged in a plain-text client.
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const interviewCall = (data) => {
  const {
    name,
    fatherName,
    cnic,
    phone,
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
    customHtml,
    isReminder = false,
    subject: subjectOverride,
  } = data;

  const subject =
    String(subjectOverride || "").trim() ||
    `${isReminder ? "Reminder: " : ""}Interview call${
      courseName ? ` - ${courseName}` : ""
    } | Digibizz Program`;

  // The admin picks one or the other: the built-in letter, or their own HTML.
  // Custom HTML replaces the message outright rather than being wrapped in the
  // branded shell - half-applying someone's markup produces a worse result
  // than either choice made cleanly.
  if (String(customHtml || "").trim()) {
    const html = applyMergeTokens(customHtml, data);
    return { subject, html, text: customHtmlToText(html) };
  }

  const rows = detailRows([
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
    `Support: ${SUPPORT_EMAIL}`,
    "",
    "Best regards,",
    "Admissions Team - Digibizz Program",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, text, html };
};

module.exports = { interviewCall, applyMergeTokens, customHtmlToText, MERGE_TOKENS };
