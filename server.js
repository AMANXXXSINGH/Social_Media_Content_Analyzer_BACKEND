const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
const axios = require("axios");
const Tesseract = require("tesseract.js");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "./uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("Upload route hit");

  try {
    if (!req.file) {
      console.log("No file received");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File received:", req.file.originalname);

    const filePath = req.file.path;
    const fileType = req.file.mimetype;

    let extractedText = "";

    if (fileType === "application/pdf") {
      console.log("Processing PDF...");
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      extractedText = data.text;
    } else if (fileType.startsWith("image/")) {
      console.log("Processing Image...");
      const result = await Tesseract.recognize(filePath, "eng");
      extractedText = result.data.text;
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const suggestions = await analyzeContentWithAI(extractedText);

    // Comment this temporarily
    // fs.unlinkSync(filePath);

    res.json({ text: extractedText, suggestions });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

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
- Do NOT ask any questions.
- Do NOT ask for clarification.
- Do NOT mention AI.
- Do NOT say "As an AI".
- Do NOT add explanations.
- Only provide improvement suggestions.
- Keep suggestions short and direct.
- Return exactly 5 bullet points.
`,
          },
          {
            role: "user",
            content: `Analyze this social media post and give 5 short improvement suggestions:\n\n${text}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            "https://social-media-content-analyzer-5rme5a76u-amanxxxsinghs-projects.vercel.app",

          "X-Title": "Social Media Analyzer",
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);
    return "AI suggestion failed.";
  }
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
