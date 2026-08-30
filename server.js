require("dotenv").config();
const express = require("express");
const path = require("path");
const app = require("./app");
// app.js owns the app.listen() call; this is the http.Server it returned.
// Without it `server` below was undefined and every SIGTERM threw instead of
// shutting down cleanly.
const server = app.server;

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
