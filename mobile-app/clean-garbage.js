const fs = require('fs');
const path = require('path');

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(file => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const dirs = [path.join(__dirname, 'app'), path.join(__dirname, 'components')];
dirs.forEach(dir => {
  walk(dir, (err, files) => {
    if (err) throw err;
    files.forEach(file => {
      let content = fs.readFileSync(file, 'utf8');
      let balance = 0;
      let lastGoodIndex = -1;
      let inString = false;
      let quoteChar = '';

      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if ((char === "'" || char === '"' || char === "`") && content[i-1] !== '\\') {
          if (!inString) {
            inString = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inString = false;
          }
        }
        if (!inString) {
          if (char === '{') balance++;
          if (char === '}') {
            balance--;
            if (balance === 0) {
                // Peek ahead to see if it's });
                if (content[i+1] === ';' || (content[i+1] === ')' && content[i+2] === ';') || (content[i+1] === ')' && content[i+2] === '\n')) {
                    // skip until end of that statement
                }
                lastGoodIndex = i;
            }
          }
        }
      }
      
      // Special case for });
      const lastSemicolon = content.lastIndexOf(';');
      if (lastSemicolon > lastGoodIndex) {
          // If the last semicolon is after the last brace balance 0, it might be the });
          const snippet = content.substring(lastGoodIndex, lastSemicolon + 1);
          if (snippet.includes('});')) {
              lastGoodIndex = lastSemicolon;
          }
      }

      if (lastGoodIndex !== -1 && lastGoodIndex < content.length - 2) {
          const cleaned = content.substring(0, lastGoodIndex + 1);
          if (cleaned.length < content.length - 5) {
              fs.writeFileSync(file, cleaned + '\n', 'utf8');
              console.log('Cleaned up: ' + file);
          }
      }
    });
  });
});
