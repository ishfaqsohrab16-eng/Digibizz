require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true", // Use SSL (true for port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
  try {
    const styledHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #4CAF50; margin: 0;">Digibizz Program </h2>
                    <p style="color: #555; font-size: 14px;">Your trusted platform</p>
                </div>
                <div style="padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <h3 style="color: #333; margin-bottom: 10px;">${subject}</h3>
                    <p style="color: #555; font-size: 14px; line-height: 1.6;">${text}</p>
                    <div style="margin: 20px 0; padding: 15px; background-color: #f1f1f1; border-radius: 8px; text-align: center;">
                        <p style="color: #333; font-size: 16px; margin: 0;"><strong>${html}</strong></p>
                    </div>
                    <p style="color: #555; font-size: 14px; line-height: 1.6;">If you did not request this, please ignore this email.</p>
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
                    <p>© ${new Date().getFullYear()} Code Hustlers. All rights reserved.</p>
                </div>
            </div>
        `;

    let info = await transporter.sendMail({
      from: `"Digibizz Program " <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: styledHtml,
    });
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = sendEmail;
