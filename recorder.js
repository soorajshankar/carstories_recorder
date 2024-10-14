const puppeteer = require("puppeteer");
const fs = require("fs");
const { spawn } = require("child_process");
const socialMediaPublisher = require("./socialMediaPublisher");

(async () => {
  let browser;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    console.log("Setting viewport...");
    await page.setViewport({
      width: 414,
      height: 896,
    });

    const url =
      "https://carstories.in/car/Maruti_Swift?variant=Maruti_Swift_ZXi_Plus_AMT_DT";
    console.log(`Navigating to ${url}...`);

    // Set a timeout for navigation
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 60000, // 60 seconds timeout
    });

    console.log("Page loaded successfully.");

    console.log("Starting recording...");
    const client = await page.target().createCDPSession();
    await client.send("Page.startScreencast", {
      format: "png",
      quality: 100,
      everyNthFrame: 1,
    });

    const frames = [];
    const framesToCapture = 60 * 30; // 60 seconds * 30 fps
    let frameCount = 0;

    client.on("Page.screencastFrame", async (frame) => {
      if (frameCount < framesToCapture) {
        frames.push(frame.data);
        frameCount++;
      }
      await client.send("Page.screencastFrameAck", {
        sessionId: frame.sessionId,
      });
      if (frameCount >= framesToCapture) {
        await client.send("Page.stopScreencast");
      }
    });

    console.log("Recording for 60 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 62000)); // Wait slightly longer to ensure all frames are captured

    console.log("Saving video...");
    const ffmpeg = require("fluent-ffmpeg");
    const stream = require("stream");

    const inputStream = new stream.PassThrough();
    const outputFilePath = "output.mp4";

    ffmpeg(inputStream)
      .inputFormat("image2pipe")
      .inputFPS(30)
      .output(outputFilePath)
      .videoCodec("libx264")
      .videoBitrate("1500k")
      .outputOptions("-pix_fmt yuv420p")
      .outputOptions("-t", "60") // Limit output to 60 seconds
      .outputOptions("-y") // Overwrite output file without prompting
      .on("end", () => {
        console.log("Video saved successfully");
        addAudioToVideo(outputFilePath);
      })
      .on("error", (err) => {
        console.error("Error saving video:", err);
        browser.close();
        process.exit(1);
      })
      .run();

    for (const frame of frames) {
      inputStream.write(Buffer.from(frame, "base64"));
    }
    inputStream.end();
  } catch (error) {
    console.error("An error occurred:", error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }

  async function publishToSocialMedia(videoPath) {
    try {
      const caption = "Check out this amazing car! #CarStories #MarutiSwift";
      const mediaId = await socialMediaPublisher.publish(
        "instagram",
        videoPath,
        caption
      );
      console.log(`Successfully published to Instagram. Media ID: ${mediaId}`);
    } catch (error) {
      console.error("Error publishing to social media:", error);
    }
  }

  function addAudioToVideo(videoPath) {
    const outputWithAudio = "output_with_audio.mp4";
    const audioFile = "bg.mp3";

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-stream_loop",
      "-1",
      "-i",
      audioFile,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-shortest",
      "-t",
      "60", // Limit output to 60 seconds
      "-y",
      outputWithAudio,
    ]);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`Child process exited with code ${code}`);
      if (code === 0) {
        console.log("Video with looped audio saved successfully");
        // publishToSocialMedia(outputWithAudio);
      } else {
        console.error("Error adding looped audio to video");
      }
      browser.close();
      process.exit(code);
    });
  }
})();
