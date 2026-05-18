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
      
      // 1. Fix: }, followed by property
      content = content.replace(/},\s+(borderWidth|borderColor|shadowOpacity|shadowRadius|elevation|paddingHorizontal|paddingVertical|backgroundColor|flexDirection|alignItems|justifyContent|borderRadius|color|fontSize|fontWeight|marginTop|marginBottom|marginHorizontal|marginVertical|width|height|flex|zIndex|marginLeft|marginRight|letterSpacing):/g, ',\n    $1:');
      
      // 2. Fix lonely commas
      content = content.replace(/,\s*,\s*/g, ',\n    ');

      // 3. Ensure shadowOffset is closed
      content = content.replace(/shadowOffset: { ([^}]*) ,/g, 'shadowOffset: { $1 },');

      // 4. Clean up endings
      let lines = content.split('\n');
      while (lines.length > 0 && (lines[lines.length-1].trim() === '}' || lines[lines.length-1].trim() === '});' || lines[lines.length-1].trim() === '' || lines[lines.length-1].trim() === '}}' || lines[lines.length-1].trim() === '}}}')) {
          lines.pop();
      }
      content = lines.join('\n') + '\n  }\n});\n';

      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Cleaned up: ' + file);
      }
    });
  });
});
