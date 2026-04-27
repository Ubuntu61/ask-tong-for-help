const fs = require('fs');
const path = require('path');

const serverDir = path.join(process.cwd(), 'dist', 'server');
const serverAssetsDir = path.join(process.cwd(), 'dist', 'server', 'assets');
const clientDir = path.join(process.cwd(), 'dist', 'client');

function findWorkerFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.startsWith('worker-entry-') && file.endsWith('.js')) {
      return path.join(dir, file);
    }
  }
  return null;
}

try {
  let workerFilePath = findWorkerFile(serverAssetsDir) || findWorkerFile(serverDir);

  if (workerFilePath) {
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }
    const dest = path.join(clientDir, '_worker.js');
    fs.copyFileSync(workerFilePath, dest);
    console.log(`Successfully copied ${path.basename(workerFilePath)} to _worker.js`);
  } else {
    console.error('Could not find worker-entry file in dist/server or dist/server/assets');
    process.exit(1);
  }
} catch (err) {
  console.error('Error moving worker file:', err);
  process.exit(1);
}
