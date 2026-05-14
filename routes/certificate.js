const express = require("express");
const router = express.Router();
const { generateCertificate } = require("../controllers/generateCertificate");

router.post("/generate", generateCertificate);

module.exports = router;
