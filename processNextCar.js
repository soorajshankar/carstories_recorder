const fs = require("fs").promises;
const { spawn } = require("child_process");

async function processNextCar() {
  try {
    // Read the car list
    const carListData = await fs.readFile("carNames.json", "utf8");
    const carList = JSON.parse(carListData);

    // Find the first unprocessed car
    const unprocessedCar = carList.find((car) => !car.processed);

    if (!unprocessedCar) {
      console.log("All cars have been processed");
      return;
    }

    console.log(`Processing car: ${unprocessedCar.name}`);

    // Run the recorder script
    await new Promise((resolve, reject) => {
      // sanitize carName by replacing all spaces with underscores
      const sanitizedCarName = unprocessedCar.name.replace(/ /g, "_");
      const process = spawn("node", ["recorder.js", sanitizedCarName]);

      process.stdout.on("data", (data) => {
        console.log(`recorder.js output: ${data}`);
      });

      process.stderr.on("data", (data) => {
        console.error(`recorder.js error: ${data}`);
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`recorder.js exited with code ${code}`));
        }
      });
    });

    // Mark the car as processed
    unprocessedCar.processed = true;

    // Save the updated car list
    await fs.writeFile("carNames.json", JSON.stringify(carList, null, 2));

    console.log(`Successfully processed ${unprocessedCar.name}`);
  } catch (error) {
    console.error("Error processing car:", error);
    process.exit(1);
  }
}

processNextCar();
