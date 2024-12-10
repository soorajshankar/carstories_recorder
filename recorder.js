const { chromium } = require('playwright');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class VideoRecorder {
    constructor(carName) {
        this.carName = carName;
        this.mainOutputDir = './output';
        this.carOutputDir = path.join(this.mainOutputDir, carName);
        this.videoWithoutAudio = path.join(this.carOutputDir, 'output_without_audio.mp4');
        this.videoWithAudio = path.join(this.carOutputDir, 'output_with_audio.mp4');
        this.audioFile = 'bg.mp3';
    }

    async initialize() {
        this.createDirectories();
    }

    createDirectories() {
        if (!fs.existsSync(this.mainOutputDir)) {
            fs.mkdirSync(this.mainOutputDir);
        }
        if (!fs.existsSync(this.carOutputDir)) {
            fs.mkdirSync(this.carOutputDir);
        }
    }

    async recordVideo() {
        const browser = await chromium.launch({
            headless: true,
            args: ['--window-size=1920,1080']
        });

        const context = await browser.newContext({
            recordVideo: {
                dir: this.carOutputDir,
                size: { width: 1080, height: 1929 }
            },
            viewport: { width: 1080, height: 1929 }
        });

        try {
            const page = await context.newPage();
            await this.captureVideo(page);
            await this.processVideo(context, browser);
        } catch (error) {
            console.error('Error during recording:', error);
            await browser.close();
            throw error;
        }
    }

    async captureVideo(page) {
        const url = `https://carstories.in/reel/${this.carName}`;
        // const url = `http://localhost:2277/reel/${this.carName}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(60000); // Wait for 60 seconds
    }

    async processVideo(context, browser) {
        await context.close();
        await browser.close();

        const recordings = fs.readdirSync(this.carOutputDir).filter(file => file.endsWith('.webm'));
        const recordedVideoPath = path.join(this.carOutputDir, recordings[recordings.length - 1]);

        try {
            await this.convertVideo(recordedVideoPath);
            console.log('Video conversion completed. Adding audio...');
            await this.addAudioToVideo();
            console.log('Audio addition completed.');
            
            // Clean up the video without audio if needed
            if (fs.existsSync(this.videoWithoutAudio)) {
                fs.unlinkSync(this.videoWithoutAudio);
                console.log('Cleaned up intermediate video file.');
            }
        } catch (error) {
            console.error('Error in video processing:', error);
            throw error;
        }
    }

    async convertVideo(recordedVideoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(recordedVideoPath)
                .outputOptions([
                    '-c:v libx264',
                    '-crf 23',
                    '-preset medium',
                    '-c:a aac',
                    '-b:a 128k'
                ])
                .output(this.videoWithoutAudio)
                .on('end', () => {
                    fs.unlinkSync(recordedVideoPath);
                    console.log(`Video saved to: ${this.videoWithoutAudio}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error during conversion:', err);
                    reject(err);
                })
                .run();
        });
    }

    async addAudioToVideo() {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-i', this.videoWithoutAudio,
                '-stream_loop', '-1',
                '-i', this.audioFile,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-shortest',
                '-t', '60',
                '-y',
                this.videoWithAudio
            ]);

            ffmpeg.stderr.on('data', (data) => {
                console.error(`${data}`);
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    console.log('Video with looped audio saved successfully');
                    resolve();
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(error);
            });
        });
    }
}

async function main() {
    const carName = process.argv[2];
    if (!carName) {
        console.error('Please provide a car name as an argument');
        process.exit(1);
    }

    const recorder = new VideoRecorder(carName);
    try {
        await recorder.initialize();
        await recorder.recordVideo();
        console.log('Video recording and processing completed successfully');
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main().catch(console.error);