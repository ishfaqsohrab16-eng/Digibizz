const { createCanvas, loadImage, registerFont } = require("canvas");
const CenterDates = require("../models/centersDatesModel");
registerFont("./fonts/GreatVibes-Regular.ttf", { family: "GreatVibes" });
registerFont("./fonts/Poppins-Bold.ttf", { family: "Poppins" });
registerFont("./fonts/Roboto-Regular.ttf", { family: "Roboto" });
registerFont("./fonts/PTSerif-Regular.ttf", { family: "PT Serif" });

async function generateCertificate(req, res) {
  try {
    const data = req.body;
    const canvas = createCanvas(1087, 768);
    const ctx = canvas.getContext("2d");
    const centerDate = await CenterDates.findOne({
      where: { center_id: data.center_id, tb_id: data.tb_id },
    });
    let gender = data.gender.toLowerCase();
    let genderControl = gender === "male" ? "S/O" : "D/O";
    if (!centerDate) {
      return res.status(404).json({ success: false, message: "Center or course not found" });
    }
    let startDate = centerDate.tb_start ? new Date(centerDate.tb_start).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
    let endDate = centerDate.tb_end ? new Date(centerDate.tb_end).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
    // Load and draw background
    const background = await loadImage("./certificateBGImages/ITTI.png");
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // --- Draw Texts ---
    ctx.font = "18px Poppins";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText(
      "   SCIENCE AND IT DEPARTMENT\n GOVERNMENT OF BALOCHISTAN",
      canvas.width / 2,
      270
    );

    // "Certifies" Title
    ctx.font = "italic 45px GreatVibes";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText("Certifies", canvas.width / 2, 350);

    // Name
    ctx.font = "bold 18px PT Serif";
    ctx.fillStyle = "#000";
    ctx.fillText(`${data.name} ${genderControl} ${data.FatherName}`, canvas.width / 2, 390);

    // Success line
    ctx.font = "14px Poppins";
    ctx.fillText(
      "    AS A SUCCESSFUL AND ACTIVE FREELANCER UPON COMPLETION OF ",
      canvas.width / 2,
      430
    );
    ctx.fillText(
      " 4-MONTHS HANDS-ON TRAINING ON MAJOR FREELANCE PLATFORMS IN",
      canvas.width / 2,
      445
    );
    // Course
    ctx.font = "italic 20px GreatVibes";
    ctx.fillText(data.course, canvas.width / 2, 480);

    // Dates
    ctx.font = "14px Roboto";
    ctx.fillText(
      `From ${startDate} to ${endDate}`,
      canvas.width / 2,
      500
    );
    ctx.fillText(`at ${data.center}`, canvas.width / 2, 525);

    // Send as PNG buffer for download
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${data.name}.png"`
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: "Certificate generation failed", error: err.message });
  }
}

module.exports = { generateCertificate };
