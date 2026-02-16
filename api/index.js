const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdf = require("pdf-parse");
const axios = require("axios");
const Tesseract = require("tesseract.js");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Multer (memory storage for Vercel)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit (important for Vercel)
});

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running successfully 🚀" });
});

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("Upload route hit");

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileType = req.file.mimetype;
    let extractedText = "";

    // ===== PDF Processing =====
    if (fileType === "application/pdf") {
      console.log("Processing PDF...");
      const data = await pdf(req.file.buffer);
      extractedText = data.text;
    }

    // ===== Image Processing =====
    else if (fileType.startsWith("image/")) {
      console.log("Processing Image...");
      const result = await Tesseract.recognize(
        req.file.buffer,
        "eng",
        { logger: () => {} } // disables heavy logging
      );
      extractedText = result.data.text;
    }

    else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: "Could not extract text" });
    }

    const suggestions = await analyzeContentWithAI(extractedText);

    return res.json({
      extractedText,
      suggestions
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({
      error: "Server processing failed",
      details: error.message
    });
  }
});

// AI Analysis Function
async function analyzeContentWithAI(text) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content: `
You are a professional social media marketing consultant.

Rules:
- Do NOT ask questions.
- Do NOT mention AI.
- Do NOT add explanations.
- Only provide improvement suggestions.
- Keep suggestions short and direct.
- Return exactly 5 bullet points.
`
          },
          {
            role: "user",
            content: `Analyze this social media post and give 5 short improvement suggestions:\n\n${text}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://your-frontend.vercel.app",
          "X-Title": "Social Media Analyzer"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);
    return "AI suggestion failed.";
  }
}

// Export for Vercel
module.exports = app;
