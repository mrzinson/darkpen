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
      let originalContent = content;
      
      // Fix lonely commas introduced by previous replace
      content = content.replace(/,\s*,\s*/g, ',\n    ');

      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed lonely commas in: ' + file);
      }
    });
  });
});
