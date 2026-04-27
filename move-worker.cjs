const fs = require('fs');
const path = require('path');

const serverDir = path.join(process.cwd(), 'dist', 'server');
const serverAssetsDir = path.join(process.cwd(), 'dist', 'server', 'assets');
const clientDir = path.join(process.cwd(), 'dist', 'client');

function copyWorkerAndDependencies() {
  let workerDir = null;
  let workerFileName = null;

  if (fs.existsSync(serverAssetsDir)) {
    const files = fs.readdirSync(serverAssetsDir);
    const workerFile = files.find(f => f.startsWith('worker-entry-') && f.endsWith('.js'));
    if (workerFile) {
      workerDir = serverAssetsDir;
      workerFileName = workerFile;
    }
  }

  if (!workerDir && fs.existsSync(serverDir)) {
    const files = fs.readdirSync(serverDir);
    const workerFile = files.find(f => f.startsWith('worker-entry-') && f.endsWith('.js'));
    if (workerFile) {
      workerDir = serverDir;
      workerFileName = workerFile;
    }
  }

  if (workerDir && workerFileName) {
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    const files = fs.readdirSync(workerDir);
    for (const file of files) {
      const src = path.join(workerDir, file);
      if (fs.statSync(src).isDirectory()) continue;

      if (file === workerFileName) {
        fs.copyFileSync(src, path.join(clientDir, '_worker.js'));
      } else {
        fs.copyFileSync(src, path.join(clientDir, file));
      }
    }
    
    // Now fix all imports in the copied files
    const clientFiles = fs.readdirSync(clientDir);
    for (const file of clientFiles) {
      if (!file.endsWith('.js')) continue;
      
      const filePath = path.join(clientDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      
      const searchString = `./${workerFileName}`;
      if (content.includes(searchString)) {
        content = content.split(searchString).join('./_worker.js');
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
    
    console.log(`Successfully copied worker dependencies and renamed ${workerFileName} to _worker.js`);
  } else {
    console.error('Could not find worker-entry file in dist/server or dist/server/assets');
    process.exit(1);
  }
}

try {
  copyWorkerAndDependencies();
} catch (err) {
  console.error('Error moving worker files:', err);
  process.exit(1);
}
