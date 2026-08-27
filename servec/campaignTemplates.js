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
    if (resolve) {
      const value = resolve(data);
      // A known token with no value falls through to the uploaded row, so a
      // list campaign can supply {{course}} from its own spreadsheet column
      // even though there is no candidate record behind it.
      if (value !== undefined && value !== null && String(value) !== "") {
        return escapeHtml(value);
      }
    }

    const extra = data?.merge?.[key];
    return extra === undefined || extra === null ? "" : escapeHtml(extra);
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

  // Custom HTML is the message, sent exactly as written.
  //
  // It used to be run through merge-token substitution first. That was removed
  // deliberately: one template now goes to every recipient unchanged, so what
  // is typed into the editor is byte-for-byte what arrives - including any
  // literal {{...}} the author happens to want in their text, which
  // substitution would silently have blanked.
  if (String(customHtml || "").trim()) {
    const html = String(customHtml);
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


/**
 * One-time code confirming an applicant's email address.
 *
 * Deliberately plain and short. A code email is read in three seconds on a
 * phone, often in a notification preview, so the code itself leads and there
 * is nothing to scroll past. It also offers nothing to click: the code is
 * typed back into the form the applicant already has open, and there is no
 * "confirm" button to press. Teaching applicants to click a link in a message
 * about their account is the habit phishing relies on. (The shared footer
 * still carries a support mailto, which is not an action link.)
 *
 * @param {object} data
 * @param {string} data.code
 * @param {number} [data.expiresInMinutes]
 * @returns {{subject: string, text: string, html: string}}
 */
const verificationCode = (data) => {
  const code = String(data?.code || "");
  const minutes = Number(data?.expiresInMinutes) || 15;

  // The code is in the subject too, so it can be read from the notification
  // without opening the message.
  const subject = `${code} is your Digibizz verification code`;

  const html = documentShell(
    subject,
    `
      <p style="margin:0 0 14px;color:#263238;font-size:16px;">Confirm your email address</p>
      <p style="margin:0 0 20px;color:#546e7a;font-size:14px;line-height:1.7;">
        Enter this code on the registration form to confirm this address belongs
        to you.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td align="center" style="background-color:#f5f7f8;border:1px solid #e0e6e3;border-radius:8px;padding:22px;">
            <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:#1f2d28;">${escapeHtml(
              code
            )}</div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;color:#546e7a;font-size:14px;line-height:1.7;">
        The code expires in ${minutes} minutes.
      </p>
      <p style="margin:0;color:#90a4ae;font-size:13px;line-height:1.7;">
        If you did not start a Digibizz application, you can ignore this email -
        no account is created until the code is entered.
      </p>
    `
  );

  const text = [
    "Confirm your email address",
    "",
    `Your Digibizz verification code is: ${code}`,
    "",
    `Enter it on the registration form. The code expires in ${minutes} minutes.`,
    "",
    "If you did not start a Digibizz application, you can ignore this email -",
    "no account is created until the code is entered.",
    "",
    `Support: ${SUPPORT_EMAIL}`,
  ].join("\n");

  return { subject, text, html };
};


/**
 * "You have been selected" letter, sent to recommended candidates.
 *
 * Everything time-and-place related - class start date, class timing, venue,
 * reporting time - is entered on the campaign at send time rather than read
 * from the database, because that is how the program actually works: the
 * schedule is decided per intake, not stored per center.
 *
 * Personal details come from the candidate's own application, so the letter
 * confirms back what they applied for and they can spot a wrong course or
 * center before the first day rather than on it.
 *
 * @param {object} data
 * @param {string} data.name
 * @param {string} [data.fatherName]
 * @param {string} [data.cnic]
 * @param {string} [data.phone]
 * @param {string} [data.courseName]
 * @param {string} [data.centerName]
 * @param {string} [data.batchName]
 * @param {string} [data.interviewDate]   Class start date
 * @param {string} [data.interviewTime]   Class timing
 * @param {string} [data.reportingTime]   Reporting time on day one
 * @param {string} [data.venue]           Class venue
 * @param {string} [data.contactPerson]
 * @param {string} [data.contactPhone]
 * @param {string} [data.message]
 * @param {string} [data.subject]
 * @returns {{subject: string, text: string, html: string}}
 */
const recommendationLetter = (data) => {
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
    subject: subjectOverride,
  } = data;

  const subject =
    String(subjectOverride || "").trim() ||
    `You have been selected${courseName ? ` for ${courseName}` : ""} | Digibizz Program`;

  const rows = detailRows([
    ["Course", courseName],
    ["Center", centerName],
    ["Training Batch", batchName],
    ["Classes Begin", formatDate(interviewDate) || interviewDate],
    ["Class Timing", interviewTime],
    ["Reporting Time", reportingTime],
    ["Class Venue", venue],
    ["Contact Person", contactPerson],
    ["Contact Number", contactPhone],
  ]);

  const applicantRows = detailRows([
    ["Name", name],
    ["Father's Name", fatherName],
    ["CNIC", maskCnic(cnic)],
    ["Contact No.", phone],
  ]);

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
      <p style="margin:0 0 18px;color:#546e7a;font-size:14px;line-height:1.7;">
        Congratulations &mdash; following your interview you have been
        <strong>recommended for admission</strong> to the Digibizz Program${
          courseName ? ` for <strong>${escapeHtml(courseName)}</strong>` : ""
        }${centerName ? ` at <strong>${escapeHtml(centerName)}</strong>` : ""}.
        Your class details are below.
      </p>

      ${messageBlock}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceff1;border-radius:8px;border-collapse:separate;overflow:hidden;margin-bottom:18px;">
        <tr>
          <td colspan="2" style="background-color:#f5f7f8;padding:12px 14px;color:#37474f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Class</td>
        </tr>
        ${rows}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceff1;border-radius:8px;border-collapse:separate;overflow:hidden;margin-bottom:22px;">
        <tr>
          <td colspan="2" style="background-color:#f5f7f8;padding:12px 14px;color:#37474f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Details</td>
        </tr>
        ${applicantRows}
      </table>

      <p style="margin:0 0 10px;color:#37474f;font-size:14px;font-weight:700;">Bring on your first day</p>
      <ul style="margin:0 0 22px;padding-left:20px;color:#546e7a;font-size:14px;line-height:1.8;">
        <li>Your <strong>original CNIC</strong> and one photocopy</li>
        <li>Original <strong>educational documents</strong> and photocopies</li>
        <li>Two recent <strong>passport-size photographs</strong></li>
        <li>A notebook and pen</li>
      </ul>

      <p style="margin:0 0 22px;color:#546e7a;font-size:14px;line-height:1.7;">
        Attendance is taken from the first class. If you cannot attend on the
        starting date, please tell us in advance${
          contactPhone ? ` on ${escapeHtml(contactPhone)}` : ""
        } so your seat is not given to someone on the waiting list.
      </p>

      <p style="margin:22px 0 0;color:#546e7a;font-size:14px;line-height:1.7;">
        Best regards,<br /><strong>Admissions Team</strong><br />Digibizz Program
      </p>
    `
  );

  const text = [
    `Dear ${name || "Applicant"},`,
    "",
    `Congratulations - following your interview you have been recommended for admission to the Digibizz Program${
      courseName ? ` for ${courseName}` : ""
    }${centerName ? ` at ${centerName}` : ""}. Your class details are below.`,
    "",
    message ? message : null,
    message ? "" : null,
    "YOUR CLASS",
    courseName ? `Course: ${courseName}` : null,
    centerName ? `Center: ${centerName}` : null,
    batchName ? `Training Batch: ${batchName}` : null,
    interviewDate
      ? `Classes Begin: ${formatDate(interviewDate) || interviewDate}`
      : null,
    interviewTime ? `Class Timing: ${interviewTime}` : null,
    reportingTime ? `Reporting Time: ${reportingTime}` : null,
    venue ? `Class Venue: ${venue}` : null,
    contactPerson ? `Contact Person: ${contactPerson}` : null,
    contactPhone ? `Contact Number: ${contactPhone}` : null,
    "",
    "YOUR DETAILS",
    name ? `Name: ${name}` : null,
    fatherName ? `Father's Name: ${fatherName}` : null,
    maskCnic(cnic) ? `CNIC: ${maskCnic(cnic)}` : null,
    phone ? `Contact No.: ${phone}` : null,
    "",
    "BRING ON YOUR FIRST DAY",
    "- Your original CNIC and one photocopy",
    "- Original educational documents and photocopies",
    "- Two recent passport-size photographs",
    "- A notebook and pen",
    "",
    "Attendance is taken from the first class. If you cannot attend on the",
    "starting date, please tell us in advance so your seat is not given to",
    "someone on the waiting list.",
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

/**
 * Pick the right letter for a campaign.
 *
 * Custom HTML wins over every kind: if an admin wrote their own message, that
 * IS the message. Otherwise the kind decides, and an unknown kind falls back
 * to the interview letter rather than sending nothing.
 */
const renderCampaignEmail = (data) => {
  if (String(data?.customHtml || "").trim()) {
    // interviewCall already handles the custom-HTML branch, and routing it
    // through one place keeps merge-token behaviour identical for every kind.
    return interviewCall(data);
  }

  switch (String(data?.kind || "").toLowerCase()) {
    case "recommendation":
      return recommendationLetter(data);
    case "reminder":
      return interviewCall({ ...data, isReminder: true });
    default:
      return interviewCall(data);
  }
};

module.exports = {
  interviewCall,
  recommendationLetter,
  renderCampaignEmail,
  verificationCode,
  applyMergeTokens,
  customHtmlToText,
  MERGE_TOKENS,
};
