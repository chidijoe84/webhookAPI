const express = require("express");
const mysql = require("mysql2/promise");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Create MySQL connection
const connectDB = async () => {
  return await mysql.createConnection({
    host: "mysql.railway.internal",
    user: "root", // Change to your MySQL username
    password: "QXfvkjtyLklzcFJUaWczJqkRTEDAeRtG", // Change to your MySQL password
    database: "railway", // Change to your database name
  });
};

// Webhook endpoint
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
app.listen(3000, () => console.log("Webhook server running on port 3000"));
