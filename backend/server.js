const express = require("express");
const path    = require("path");

const app = express();

// ── Serve all static frontend files ────────────────────────────────────────
const FRONTEND = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND));

// ── Named page routes (clean URLs without .html extension) ─────────────────
const pages = ["about", "contact", "faq", "privacy", "terms"];
pages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(FRONTEND, `${page}.html`));
  });
});

// ── Blog routes ────────────────────────────────────────────────────────────
app.get("/blog", (req, res) => {
  res.sendFile(path.join(FRONTEND, "blog", "index.html"));
});

const blogPosts = [
  "study-planning-guide",
  "pomodoro-technique",
  "time-management-students",
  "exam-preparation-tips",
  "student-productivity",
  "goal-setting-students",
  "daily-study-routine",
  "ai-for-students",
];
blogPosts.forEach((slug) => {
  app.get(`/blog/${slug}`, (req, res) => {
    res.sendFile(path.join(FRONTEND, "blog", `${slug}.html`));
  });
});

// ── Root: serve the SPA (index.html) ──────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND, "index.html"));
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(5000, () => {
  console.log("StudyHub AI server running → http://localhost:5000");
});