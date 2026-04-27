const fs = require('fs');
const path = require('path');

const serverDir = path.join(process.cwd(), 'dist', 'server');
const clientDir = path.join(process.cwd(), 'dist', 'client');

try {
  console.log("=== DEBUGGING BUILD OUTPUT ===");
  if (fs.existsSync(serverDir)) {
    const files = fs.readdirSync(serverDir);
    console.log("Files in dist/server:", files);
    
    if (files.includes('index.js')) {
      console.log("Contents of dist/server/index.js:", fs.readFileSync(path.join(serverDir, 'index.js'), 'utf8').substring(0, 500));
    }
    if (files.includes('server.js')) {
      console.log("Contents of dist/server/server.js:", fs.readFileSync(path.join(serverDir, 'server.js'), 'utf8').substring(0, 500));
    }
    if (files.includes('_worker.js')) {
      console.log("Contents of dist/server/_worker.js:", fs.readFileSync(path.join(serverDir, '_worker.js'), 'utf8').substring(0, 500));
    }
  }
  
  if (fs.existsSync(clientDir)) {
    console.log("Files in dist/client:", fs.readdirSync(clientDir));
  }
  console.log("==============================");
  
  // Now actually try to use index.js or server.js as the worker entry!
  let actualWorker = null;
  if (fs.existsSync(path.join(serverDir, '_worker.js'))) actualWorker = '_worker.js';
  else if (fs.existsSync(path.join(serverDir, 'index.js'))) actualWorker = 'index.js';
  else if (fs.existsSync(path.join(serverDir, 'server.js'))) actualWorker = 'server.js';
  
  if (actualWorker) {
    fs.copyFileSync(path.join(serverDir, actualWorker), path.join(clientDir, '_worker.js'));
    console.log(`Copied dist/server/${actualWorker} to dist/client/_worker.js`);
    
    // Also copy all assets
    const serverAssetsDir = path.join(serverDir, 'assets');
    if (fs.existsSync(serverAssetsDir)) {
      const assets = fs.readdirSync(serverAssetsDir);
      for (const asset of assets) {
        fs.copyFileSync(path.join(serverAssetsDir, asset), path.join(clientDir, asset));
      }
    }
  } else {
    console.log("Could not find any suitable worker entry.");
  }
} catch (err) {
  console.error("Debug script failed:", err);
}
