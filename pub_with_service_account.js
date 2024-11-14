const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, 'service-account-key.json');  // Path to your service account key JSON file
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];  // Scope for uploading videos

async function authenticateWithServiceAccount() {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();
  
  // Create the YouTube API client
  const youtube = google.youtube({
    version: "v3",
    auth: authClient,
  });

  return youtube;
}

async function uploadVideo(videoPath, title, description) {
  try {
    const youtube = await authenticateWithServiceAccount();

    const videoInsertResponse = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: title,
          description: description,
          tags: ["#Shorts"],
          categoryId: "22",  // People & Blogs category
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    console.log(`Video uploaded successfully! Video ID: ${videoInsertResponse.data.id}`);
  } catch (error) {
    console.error("Error uploading video:", error);
  }
}

// Example usage
uploadVideo("output_with_audio.mp4", "Sample Video Title", "Sample Video Description");