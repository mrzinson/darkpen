const fs = require('fs');
const path = require('path');

function getDirSize(dirPath) {
  let size = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = statsCache[filePath] || fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stats.size;
      }
    }
  } catch (err) {
    // Ignore errors
  }
  return size;
}

const statsCache = {};
const dir = path.join(process.cwd(), 'my-archive-folder');
const items = fs.readdirSync(dir);
const results = [];

for (const item of items) {
  const itemPath = path.join(dir, item);
  const stats = fs.statSync(itemPath);
  statsCache[itemPath] = stats;
  if (stats.isDirectory()) {
    const size = getDirSize(itemPath);
    results.push({ name: item, sizeMB: (size / (1024 * 1024)).toFixed(2) });
  } else {
    results.push({ name: item, sizeMB: (stats.size / (1024 * 1024)).toFixed(6) });
  }
}

results.sort((a, b) => parseFloat(b.sizeMB) - parseFloat(a.sizeMB));
console.log(JSON.stringify(results, null, 2));
