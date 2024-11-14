const { google } = require("googleapis");
const express = require("express");
const socialMediaPublisher = require("./socialMediaPublisher");

async function launchBrowser() {
  const open = await import('open');
  open.default("http://localhost:3000/authorize");  // Dynamic import for ES module
}


require('dotenv').config();

const app = express();
const port = 3000;


// Replace with your credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,    // Your Client ID
  process.env.YOUTUBE_CLIENT_SECRET, // Your Client Secret
  process.env.YOUTUBE_REDIRECT_URI, // Your redirect URI
);

const scopes = ["https://www.googleapis.com/auth/youtube.upload"];

// Step 1: Generate an OAuth URL
app.get("/authorize", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Ensures a refresh token is generated
    scope: scopes,
  });

  res.redirect(url);
});

// Step 2: Handle the callback and get the refresh token
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    res.send("No authorization code found");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Here you get the refresh token
    console.log("Refresh Token:", tokens.refresh_token);
    const videoPath = "output_with_audio.mp4";
    const caption = "Check out this amazing video! #Shorts";

    
    try {
      const mediaId = await socialMediaPublisher.publishToYoutube(videoPath, caption);
      res.send(`Authorization successful! Video published to YouTube. Media ID: ${mediaId}`);
    } catch (publishError) {
      console.error("Error publishing to YouTube:", publishError);
      res.send("Authorization successful, but there was an error publishing the video to YouTube.");
    }

    // res.send("Authorization successful! Check your console for the refresh token.");
    
  } catch (error) {
    console.error("Error retrieving tokens:", error);
    res.send("Error retrieving tokens");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
  console.log(`http://localhost:${port}/authorize`);
});