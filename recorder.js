const puppeteer = require("puppeteer");
const fs = require("fs");
const { spawn } = require("child_process");
const socialMediaPublisher = require("./socialMediaPublisher");
const path = require("path"); // Add path module


// Get command line arguments
const args = process.argv.slice(2);

// Check if there are any arguments
if (args.length === 0) {
    console.error("Please provide a car name!");
    console.log("Usage: node script.js <car_name>");
    console.log("Example: node script.js Tesla_Model_3");
    process.exit(1);
}

// Get carName from first argument
const carName = args[0];

// Validate carName (optional)
if (!/^[A-Za-z0-9_]+$/.test(carName)) {
    console.error("Car name should only contain letters, numbers, and underscores!");
    process.exit(1);
}

// Create output directory structure
const outputDir = path.join("output", carName);
fs.mkdirSync(outputDir, { recursive: true });

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
    const scaleFactor = 100;
    await page.setViewport({
      width: Math.round(9 * scaleFactor),
      height: Math.round(16 * scaleFactor),
    });

    // Start recording BEFORE navigation
    console.log("Starting recording...");
    const client = await page.target().createCDPSession();
    await client.send("Page.startScreencast", {
      format: "png",
      quality: 100,
      everyNthFrame: 1,
    });

    const frames = [];
    const framesToCapture = 60 * 30;
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

    const url = `https://carstories.in/car/${carName}`;
    // const url = `http://localhost:2277/car/${carName}`;
    console.log(`Navigating to ${url}...`);

    // Navigate AFTER starting the recording
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("Page loaded successfully.");
    console.log("Recording for 60 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 62000));

    console.log("Saving video...");
    const ffmpeg = require("fluent-ffmpeg");
    const stream = require("stream");

    const inputStream = new stream.PassThrough();
    const outputFilePath = path.join(outputDir, "output_without_audio.mp4"); // Modified path

    ffmpeg(inputStream)
      .inputFormat("image2pipe")
      .inputFPS(30)
      .output(outputFilePath)
      .videoCodec("libx264")
      .videoBitrate("1500k")
      .outputOptions("-pix_fmt yuv420p")
      .outputOptions("-t", "60")
      .outputOptions("-y")
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

  function addAudioToVideo(videoPath) {
    const outputWithAudio = path.join(outputDir, "output_with_audio.mp4"); // Modified path
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
      "60",
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
      } else {
        console.error("Error adding looped audio to video");
      }
      browser.close();
      process.exit(code);
    });
  }
})();
