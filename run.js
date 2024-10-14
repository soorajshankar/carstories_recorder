require('dotenv').config();
const { spawn } = require('child_process');

// Check if required environment variables are set
const requiredEnvVars = ['IG_USERNAME', 'IG_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Spawn the record.js process
const recordProcess = spawn('node', ['recorder.js'], {
  stdio: 'inherit',
  env: process.env
});

recordProcess.on('close', (code) => {
  console.log(`record.js process exited with code ${code}`);
});