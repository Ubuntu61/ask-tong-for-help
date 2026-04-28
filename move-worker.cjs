const fs = require('fs');
const path = require('path');

const serverDir = path.join(process.cwd(), 'dist', 'server');
const serverAssetsDir = path.join(serverDir, 'assets');
const clientDir = path.join(process.cwd(), 'dist', 'client');
const clientAssetsDir = path.join(clientDir, 'assets');

try {
  // 1. Copy the true entry point to _worker.js
  const entryFile = path.join(serverDir, 'index.js');
  if (fs.existsSync(entryFile)) {
    fs.copyFileSync(entryFile, path.join(clientDir, '_worker.js'));
    console.log("Successfully copied dist/server/index.js to dist/client/_worker.js");
  } else {
    console.error("Could not find dist/server/index.js!");
    process.exit(1);
  }

  // 2. Merge server chunks into client assets directory
  if (fs.existsSync(serverAssetsDir)) {
    if (!fs.existsSync(clientAssetsDir)) {
      fs.mkdirSync(clientAssetsDir, { recursive: true });
    }
    
    const assets = fs.readdirSync(serverAssetsDir);
    for (const asset of assets) {
      const srcPath = path.join(serverAssetsDir, asset);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, path.join(clientAssetsDir, asset));
      }
    }
    console.log(`Merged ${assets.length} server chunks into dist/client/assets/`);
  }

  // 3. Generate _routes.json to bypass worker for static assets and use Functions for /api/*
  const routes = {
    version: 1,
    include: ["/*"],
    exclude: ["/assets/*", "/driver-manifest.json"]
  };
  fs.writeFileSync(path.join(clientDir, '_routes.json'), JSON.stringify(routes, null, 2));
  console.log("Successfully generated dist/client/_routes.json");

} catch (err) {
  console.error("Error moving worker files:", err);
  process.exit(1);
}
