const { IgApiClient, IgCheckpointError, IgNoCheckpointError } = require("instagram-private-api");
const { readFile } = require("fs").promises;
const { google } = require("googleapis");
const fs = require("fs");

async function getAccessToken() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  // Set credentials with refresh token
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  // Automatically refresh the access token
  const tokens = await oauth2Client.refreshAccessToken();
  return tokens.credentials.access_token;
}
class SocialMediaPublisher {
  constructor() {
    this.platforms = {
      instagram: this.publishToInstagram,
      youtube: this.publishToYoutube,
      // Add more platforms here in the future
      // facebook: this.publishToFacebook,
      // twitter: this.publishToTwitter,
    };
  }

  async publish(platform, videoPath, caption) {
    if (this.platforms[platform]) {
      return await this.platforms[platform](videoPath, caption);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async publishToInstagram(videoPath, caption) {
    const ig = new IgApiClient();
    console.log("Generating device...", process.env.IG_USERNAME);
    ig.state.generateDevice(process.env.IG_USERNAME);

    try {
      await ig.simulate.preLoginFlow();
      const loggedInUser = await ig.account.login(
        process.env.IG_USERNAME,
        process.env.IG_PASSWORD
      );

      process.nextTick(async () => await ig.simulate.postLoginFlow());

      const videoBuffer = await readFile(videoPath);
      const { media } = await ig.publish.video({
        video: videoBuffer,
        caption: caption,
        coverImage: await ig.upload.photo({ file: videoBuffer }),
      });

      console.log(`Video published to Instagram. Media ID: ${media.id}`);
      return media.id;
    } catch (error) {
      if (error instanceof IgCheckpointError) {
        console.log("Checkpoint error encountered. Attempting to resolve...");
        await ig.challenge.auto(true);
        console.log(
          "Please check your phone for a verification code and call this method again with the code"
        );
      } else if (error instanceof IgNoCheckpointError) {
        console.log(
          "No checkpoint data available. This might be due to an invalid session or authentication issue."
        );
        // You might want to implement a retry mechanism here or handle it according to your needs
      } else {
        console.error("Unexpected error:", error);
        throw error;
      }
    }
  }


  
  async publishToYoutube(videoPath, caption) {
    try {
      const accessToken = await getAccessToken();
  
      const youtube = google.youtube({
        version: "v3",
        auth: accessToken,
      });
  
      // Insert the video
      const videoInsertResponse = await youtube.videos.insert({
        part: "snippet,status",
        requestBody: {
          snippet: {
            title: caption,
            description: caption,
            tags: ["#Shorts"],
            categoryId: "22",
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
  
      const videoId = videoInsertResponse.data.id;
  
      // Set the video as a Short
      await youtube.videos.update({
        part: "snippet",
        requestBody: {
          id: videoId,
          snippet: {
            tags: ["#Shorts"],
          },
        },
      });
  
      console.log(`Video published to YouTube. Video ID: ${videoId}`);
      return videoId;
    } catch (error) {
      console.error("Error publishing to YouTube:", error);
      throw error;
    }
  }

  // Add methods for other platforms here
  // async publishToFacebook(videoPath, caption) { ... }
  // async publishToTwitter(videoPath, caption) { ... }
}

module.exports = new SocialMediaPublisher();
