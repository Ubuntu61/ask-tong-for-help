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

      // Copy all files verbatim
      fs.copyFileSync(src, path.join(clientDir, file));
    }
    
    // Create _worker.js that re-exports the original worker entry
    const workerJsContent = `import worker from "./${workerFileName}";\nexport * from "./${workerFileName}";\nexport default worker;\n`;
    fs.writeFileSync(path.join(clientDir, '_worker.js'), workerJsContent);
    
    console.log(`Successfully copied worker dependencies and generated _worker.js re-exporting ${workerFileName}`);
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
