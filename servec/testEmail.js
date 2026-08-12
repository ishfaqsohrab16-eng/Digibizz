/**
 * SMTP diagnostic / preview tool.
 *
 *   node servec/testEmail.js                      -> verify connection + credentials only
 *   node servec/testEmail.js you@example.com      -> verify, then send a sample
 *                                                    "application received" email
 *
 * Set SMTP_DEBUG=true for the full SMTP conversation.
 */
require("dotenv").config();
const { sendEmail, verifyTransport, transporter } = require("./emailConfig");
const { applicationReceived } = require("./emailTemplates");

const recipient = process.argv[2];

(async () => {
  console.log("SMTP settings in use:");
  console.log("  host  :", process.env.SMTP_HOST);
  console.log("  port  :", process.env.SMTP_PORT);
  console.log("  secure:", process.env.SMTP_SECURE);
  console.log("  user  :", process.env.SMTP_USER);
  console.log("  from  :", process.env.SMTP_FROM || process.env.SMTP_USER);
  console.log(
    "  tls.rejectUnauthorized:",
    String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED).toLowerCase() === "true"
  );
  console.log("");

  const ok = await verifyTransport();
  if (!ok) {
    console.error("\nConnection/credential check FAILED - not sending.");
    transporter.close();
    process.exit(1);
  }

  if (!recipient) {
    console.log("\nConnection OK. Pass an address to send a sample email:");
    console.log("  node servec/testEmail.js you@example.com");
    transporter.close();
    return;
  }

  const { subject, text, html } = applicationReceived({
    applicationId: 1234,
    name: "Test Applicant",
    fatherName: "Test Father",
    cnic: "5440012345671",
    phone: "0300-1234567",
    gender: "Male",
    courseName: "Web & Mobile Application Development",
    centerName: "Quetta Center",
    batchName: "Batch 3",
    batchStart: new Date(),
    appliedOn: new Date(),
  });

  try {
    await sendEmail({ to: recipient, subject, text, html });
    console.log(`\nSample email sent to ${recipient}.`);
  } catch (error) {
    console.error("\nSend FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
})();
