const { IgApiClient, IgCheckpointError } = require("instagram-private-api");
const { readFile } = require("fs").promises;

class SocialMediaPublisher {
  constructor() {
    this.platforms = {
      instagram: this.publishToInstagram,
      // Add more platforms here in the future
      // youtube: this.publishToYoutube,
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

  // Add methods for other platforms here
  // async publishToYoutube(videoPath, caption) { ... }
  // async publishToFacebook(videoPath, caption) { ... }
  // async publishToTwitter(videoPath, caption) { ... }
}

module.exports = new SocialMediaPublisher();
