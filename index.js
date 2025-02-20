const express = require("express");
const mysql = require("mysql2/promise");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// MySQL Connection
const connectDB = async () => {
  const connection = await mysql.createConnection({
    host: "mysql.railway.internal",
    user: "root",
    password: "QXfvkjtyLklzcFJUaWczJqkRTEDAeRtG",
    database: "railway",
  });
  return connection;
};

// Webhook endpoint (existing)
app.post("/predis-webhook", async (req, res) => {
  const { post_id, video_url, status } = req.body;

  if (!post_id || !status) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  try {
    const connection = await connectDB();
    await connection.execute(
      `INSERT INTO predis_webhooks (post_id, video_url, status) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE video_url = VALUES(video_url), status = VALUES(status)`,
      [post_id, video_url, status]
    );
    await connection.end();

    console.log("Webhook data saved:", post_id, status);

    if (video_url && status === "completed") {
      console.log("Downloading video from URL:", video_url);

      try {
        const response = await axios({
          url: video_url,
          method: "GET",
          responseType: "stream",
        });

        const videoPath = path.join(__dirname, `videos/${post_id}.mp4`);
        const writer = fs.createWriteStream(videoPath);

        response.data.pipe(writer);

        writer.on("finish", () => console.log("Video downloaded:", videoPath));
        writer.on("error", (err) => console.error("Download error:", err));
      } catch (downloadError) {
        console.error("Error downloading video:", downloadError);
      }
    }

    res.status(200).json({ message: "Webhook received successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New Endpoint for Predis AI API
app.post("/generate-content", async (req, res) => {
  console.log("reqiuest body", req.body);
  const { brand_id, text, media_type } = req.body;

  if (!brand_id || !text || !media_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const response = await axios.post(
      "https://brain.predis.ai/predis_api/v1/create_content/",
      {
        brand_id,
        text,
        media_type,
      },
      {
        headers: {
          Authorization: "Ft4fw1FVzTO6HMTqDqniu11HMY5jkaLC",
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error generating content:", error.response?.data || error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
