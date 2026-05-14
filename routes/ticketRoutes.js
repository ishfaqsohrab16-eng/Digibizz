const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { check } = require("express-validator");
const {upload} = require("../middleware/uploadTicketConfig");
const {uploadReply} = require("../middleware/uploadTicketReplyConfig")
const {isAdminAuthenticated} = require("../middleware/authMiddleware")

// Ticket routes
router.post("/create",isAdminAuthenticated,upload.single("ticket_attachment"),  ticketController.createTicket);
router.get("/all", isAdminAuthenticated,ticketController.getAllTickets);
router.get("/:id/:user_id/:tb_id",isAdminAuthenticated, ticketController.getTicketById);
router.put("/:id",  ticketController.updateTicket);
router.delete("/:id", ticketController.deleteTicket);

// Reply routes
router.post("/reply",isAdminAuthenticated,uploadReply.single("ticket_attachment"), ticketController.createTicketReply);
router.get("/replies/:ticket_no", ticketController.getTicketReplies);

module.exports = router;
