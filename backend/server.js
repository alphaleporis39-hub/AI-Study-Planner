const express = require("express");
const cors    = require("cors");
const path    = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Usage Limits ───────────────────────────────────────────────────────────
const FREE_AI_UPLOAD_LIMIT   = 30;
const FREE_AI_QUESTION_LIMIT = 30;

// ── SQLite Database ────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "usage.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("SQLite error:", err.message);
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS ai_usage (
    user_id    TEXT NOT NULL,
    usage_type TEXT NOT NULL,
    period     TEXT NOT NULL,
    count      INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, usage_type, period)
  )`);
});

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getCurrentDay() {
  return new Date().toISOString().slice(0, 10);
}

async function getUploadCount(userId) {
  const row = await dbGet(
    "SELECT count FROM ai_usage WHERE user_id = ? AND usage_type = 'upload' AND period = ?",
    [userId, getCurrentMonth()]
  );
  return row ? row.count : 0;
}

async function getQuestionCount(userId) {
  const row = await dbGet(
    "SELECT count FROM ai_usage WHERE user_id = ? AND usage_type = 'question' AND period = ?",
    [userId, getCurrentDay()]
  );
  return row ? row.count : 0;
}

async function incUploadCount(userId) {
  const period = getCurrentMonth();
  const existing = await dbGet(
    "SELECT count FROM ai_usage WHERE user_id = ? AND usage_type = 'upload' AND period = ?",
    [userId, period]
  );
  if (existing) {
    await dbRun(
      "UPDATE ai_usage SET count = count + 1 WHERE user_id = ? AND usage_type = 'upload' AND period = ?",
      [userId, period]
    );
  } else {
    await dbRun(
      "INSERT INTO ai_usage (user_id, usage_type, period, count) VALUES (?, 'upload', ?, 1)",
      [userId, period]
    );
  }
}

async function incQuestionCount(userId) {
  const period = getCurrentDay();
  const existing = await dbGet(
    "SELECT count FROM ai_usage WHERE user_id = ? AND usage_type = 'question' AND period = ?",
    [userId, period]
  );
  if (existing) {
    await dbRun(
      "UPDATE ai_usage SET count = count + 1 WHERE user_id = ? AND usage_type = 'question' AND period = ?",
      [userId, period]
    );
  } else {
    await dbRun(
      "INSERT INTO ai_usage (user_id, usage_type, period, count) VALUES (?, 'question', ?, 1)",
      [userId, period]
    );
  }
}

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

// ═══════════════════════════════════════════════════════════════════════════
//   AI STUDY ASSISTANT API (Mock — replace with real LLM API in production)
// ═══════════════════════════════════════════════════════════════════════════

// ── AI Process Document ────────────────────────────────────────────────────
app.post("/api/ai/process", async (req, res) => {
  try {
    const { action, content, fileName, userId } = req.body;
    if (!content) return res.status(400).json({ error: "No content provided" });

    // ── Server-side usage enforcement ──────────────────────────────────────
    if (userId) {
      const uploadCount = await getUploadCount(userId);
      if (uploadCount >= FREE_AI_UPLOAD_LIMIT) {
        return res.status(429).json({
          error: "Free upload limit reached (" + FREE_AI_UPLOAD_LIMIT + "/month). Upgrade to Premium!",
          limit: FREE_AI_UPLOAD_LIMIT,
          used: uploadCount,
        });
      }
      await incUploadCount(userId);
    }

    const snippet = content.slice(0, 500);
    const wordCount = content.split(/\s+/).length;

    const responses = {
      summarize: {
        title: "Summary",
        icon: "📝",
        result: `**Document Summary** (${fileName || "uploaded file"})\n\nThis document contains approximately ${wordCount} words. Here is a concise summary based on the content:\n\nThe document covers key concepts and information relevant to academic study. The main themes include fundamental principles, practical applications, and important definitions that students should understand.\n\n**Key Takeaway:** Focus on understanding the core concepts rather than memorizing details. The material provides a solid foundation for the subject matter covered.`,
      },
      keypoints: {
        title: "Key Points",
        icon: "🔑",
        result: `**Key Points Extracted**\n\n1. **Core Concept 1:** The foundational principle establishes the framework for understanding the subject.\n2. **Core Concept 2:** Applications of the theory demonstrate real-world relevance.\n3. **Important Definition:** Key terminology that appears frequently in exams.\n4. **Critical Formula/Process:** The step-by-step methodology for solving related problems.\n5. **Common Mistake:** Areas where students typically lose marks.\n6. **Exam Focus:** Topics most likely to appear in assessments.\n\n💡 **Study Tip:** Create flashcards for points 3-5 as these are high-yield exam topics.`,
      },
      explain: {
        title: "Simple Explanation",
        icon: "💡",
        result: `**Simplified Explanation**\n\nThink of this topic like building with blocks — each concept builds on the previous one.\n\n**The Basic Idea:** At its simplest, this is about understanding how different elements connect together to form a complete picture.\n\n**Real-World Analogy:** Imagine you're following a recipe. Each ingredient (concept) has a specific role, and the order matters. Missing one ingredient changes the final result.\n\n**Why It Matters:** This concept is fundamental because it appears in multiple areas of the subject and is frequently tested.\n\n**How to Remember:** Focus on the "why" behind each step, not just the "what."`,
      },
      revision: {
        title: "Revision Notes",
        icon: "📋",
        result: `**Revision Notes**\n\n---\n\n**Topic Overview**\n- Main theme: Core principles and applications\n- Difficulty: Intermediate\n- Exam weightage: High\n\n**Must-Know Points:**\n- Definition and scope of the topic\n- Key formulas/theorems\n- Important dates or events (if applicable)\n- Common problem-solving approaches\n\n**Frequently Tested Areas:**\n1. Application-based questions\n2. Comparison/difference questions\n3. Diagram/labelling questions\n\n**Quick Revision Checklist:**\n☐ Can I define the key terms?\n☐ Can I explain the main process?\n☐ Can I solve 3 sample problems?\n☐ Can I connect this to related topics?\n\n**Time Suggestion:** Revise this in 2-3 focused sessions of 25 minutes each (Pomodoro).`,
      },
      flashcards: {
        title: "Flashcards",
        icon: "🃏",
        result: `**Flashcard Set**\n\n🃏 **Card 1**\nQ: What is the fundamental principle of this topic?\nA: The core principle establishes the relationship between key variables and provides the foundation for all applications.\n\n---\n\n🃏 **Card 2**\nQ: Name 3 real-world applications.\nA: 1) Practical problem-solving\n2) Theoretical framework development\n3) Cross-disciplinary connections\n\n---\n\n🃏 **Card 3**\nQ: What is the most common mistake students make?\nA: Confusing similar concepts and not reading the question carefully before answering.\n\n---\n\n🃏 **Card 4**\nQ: How does this connect to the previous chapter?\nA: Builds upon the foundational concepts introduced earlier, applying them in more complex scenarios.\n\n---\n\n🃏 **Card 5**\nQ: What exam format tests this most?\nA: Application-based and analytical questions, often in structured or essay format.`,
      },
      mcq: {
        title: "MCQs",
        icon: "❓",
        result: `**Multiple Choice Questions**\n\n**Q1.** What is the primary purpose of this concept?\nA) To memorize facts\nB) To understand relationships between variables ✅\nC) To simplify all topics\nD) To replace practical learning\n\n**Q2.** Which approach is most effective for this topic?\nA) Rote memorization\nB) Visual learning only\nC) Active recall and practice ✅\nD) Reading once thoroughly\n\n**Q3.** What makes this topic exam-relevant?\nA) It's the easiest chapter\nB) It appears in every exam ✅\nC) Teachers prefer it\nD) It has no practical use\n\n**Q4.** A common application of this concept is:\nA) Theoretical discussion only\nB) Real-world problem solving ✅\nC) Abstract reasoning\nD) Historical analysis\n\n**Q5.** The best study strategy for this is:\nA) Passive re-reading\nB) Highlighting everything\nC) Practice with spaced repetition ✅\nD) Studying the night before`,
      },
      quiz: {
        title: "Quiz",
        icon: "🧩",
        result: `**Quiz Mode**\n\nTest your understanding with these questions:\n\n**1. Short Answer:** Explain the core concept in your own words.\n*Expected: A clear, concise explanation covering the main principle and its significance.*\n\n**2. True/False:** This concept only applies to theoretical scenarios.\n*Answer: False — It has numerous practical applications.*\n\n**3. Fill in the Blank:** The fundamental principle states that ___ is directly proportional to ___.\n*Answer: The main variable is directly proportional to the key factor.*\n\n**4. Diagram:** Draw a simple flowchart showing the process.\n*Expected: A clear flowchart with 4-5 steps.*\n\n**5. Application:** Give a real-world example where this concept is used.\n*Expected: Any valid example demonstrating practical relevance.*\n\n**Score Guide:** 4-5 correct = Excellent | 3 = Good | 1-2 = Review needed`,
      },
      examtips: {
        title: "Exam Topics",
        icon: "🎯",
        result: `**🎯 AI-Suggested Exam Topics**\n\nBased on analysis of the document content, here are the most important topics for your exam:\n\n**🔴 High Priority (Must Study):**\n1. Core definitions and their distinctions\n2. Key formulas and when to apply them\n3. Process/methodology questions\n\n**🟡 Medium Priority (Should Study):**\n4. Comparison between related concepts\n5. Applications and case studies\n6. Common errors and how to avoid them\n\n**🟢 Low Priority (Good to Know):**\n7. Historical context and evolution\n8. Advanced extensions of basic concepts\n9. Cross-topic connections\n\n**📝 Suggested Study Order:**\n1. Start with High Priority (Day 1-2)\n2. Move to Medium Priority (Day 3-4)\n3. Review Low Priority (Day 5)\n4. Practice past papers (Day 6-7)\n\n**⚡ Quick Win:** Focus on High Priority topics — they typically account for 60-70% of exam marks.`,
      },
    };

    const response = responses[action] || responses.summarize;
    res.json({
      success: true,
      title: response.title,
      icon: response.icon,
      result: response.result,
      fileName: fileName || "document",
    });
  } catch (err) {
    console.error("AI process error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── AI Chat (Q&A from document) ────────────────────────────────────────────
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { question, content, fileName, userId } = req.body;
    if (!question) return res.status(400).json({ error: "No question provided" });

    // ── Server-side usage enforcement ──────────────────────────────────────
    if (userId) {
      const questionCount = await getQuestionCount(userId);
      if (questionCount >= FREE_AI_QUESTION_LIMIT) {
        return res.status(429).json({
          error: "Free question limit reached (" + FREE_AI_QUESTION_LIMIT + "/day). Upgrade to Premium!",
          limit: FREE_AI_QUESTION_LIMIT,
          used: questionCount,
        });
      }
      await incQuestionCount(userId);
    }

    const q = question.toLowerCase();
    let answer = "";

    if (q.includes("summary") || q.includes("summarize")) {
      answer = "Based on the document, the main content covers key academic concepts. The document emphasizes understanding core principles and their practical applications. I recommend focusing on the definitions and processes described in the first half of the document.";
    } else if (q.includes("important") || q.includes("key")) {
      answer = "The most important points from this document are: (1) The fundamental definitions that form the basis of the topic, (2) The practical applications mentioned, (3) The relationships between different concepts. These are frequently tested in exams.";
    } else if (q.includes("exam") || q.includes("test")) {
      answer = "For exam preparation based on this document, focus on: definitions, process explanations, and application-based questions. The document contains several concepts that are commonly tested. I suggest creating flashcards for the key terms.";
    } else if (q.includes("explain") || q.includes("simple")) {
      answer = "In simple terms, this document explains how different elements of the subject connect together. Think of it as a building block — each concept supports the next. The key is to understand the 'why' behind each point, not just memorize the 'what.'";
    } else if (q.includes("difficult") || q.includes("hard") || q.includes("confus")) {
      answer = "The trickiest parts of this document tend to be the nuanced distinctions between similar concepts. I recommend creating a comparison table for any terms that seem similar. Also, try explaining each concept in your own words — if you can teach it, you understand it.";
    } else {
      answer = `Based on the uploaded document (${fileName || "your file"}), here's what I found regarding your question:\n\nThe document addresses this topic through several key points. The main idea centers on understanding the core principles and their applications. For a more specific answer, try asking about a particular section or concept from the document.\n\n💡 **Tip:** Ask specific questions like "What are the key definitions?" or "How does X relate to Y?" for more detailed answers.`;
    }

    res.json({ success: true, answer, fileName: fileName || "document" });
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Payment Create (Mock) ──────────────────────────────────────────────────
app.post("/api/payment/create", (req, res) => {
  try {
    const { plan, gateway } = req.body;
    const amounts = { monthly: 19900, quarterly: 29900 };
    const amount = amounts[plan] || 19900;

    // In production, integrate Razorpay/Cashfree SDK here
    res.json({
      success: true,
      orderId: "order_" + Date.now(),
      amount,
      currency: "INR",
      gateway: gateway || "razorpay",
      plan,
      message: "Payment order created. In production, this redirects to " + (gateway || "Razorpay") + " checkout.",
    });
  } catch (err) {
    console.error("Payment create error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Payment Verify (Mock) ──────────────────────────────────────────────────
app.post("/api/payment/verify", (req, res) => {
  try {
    const { orderId, plan } = req.body;
    // In production, verify payment signature with gateway webhook
    res.json({
      success: true,
      verified: true,
      plan,
      expiresAt: new Date(Date.now() + (plan === "quarterly" ? 90 : 30) * 86400000).toISOString(),
    });
  } catch (err) {
    console.error("Payment verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Root: serve the SPA (index.html) ──────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND, "index.html"));
});

// ── Export for Vercel Serverless ────────────────────────────────────────────
module.exports = app;

// ── Start (only when running locally, not on Vercel) ───────────────────────
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`StudyHub AI server running → http://localhost:${PORT}`);
  });
}
