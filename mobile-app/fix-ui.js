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
      
      // 1. Replace background colors
      content = content.replace(/backgroundColor:\s*['"]white['"]/gi, 'backgroundColor: colors.card');
      content = content.replace(/backgroundColor:\s*['"]#fff(?:fff)?['"]/gi, 'backgroundColor: colors.card');
      content = content.replace(/backgroundColor:\s*['"]#F9FAFB['"]/gi, 'backgroundColor: colors.background');
      
      // 2. Replace border colors
      content = content.replace(/borderColor:\s*['"]#E5E7EB['"]/gi, "borderColor: colors.border || '#333'");
      
      // 3. Update titles/headings to primary color
      // Match title: { ... color: colors.secondary ... } or sectionTitle: { ... }
      content = content.replace(/(title|cardTitle|heading|sectionTitle|greetingTitle):\s*{([^}]*)}/g, (match, p1, p2) => {
        if (p2.includes('colors.secondary')) {
          return `${p1}: {${p2.replace(/colors\.secondary/g, 'colors.primary')}}`;
        }
        return match;
      });
      
      // 4. Style buttons (Add border, set background to dark if it was primary)
      // This matches keys ending in 'Button' or just 'button'
      content = content.replace(/(\w*button\w*):\s*{([^}]*)}/gi, (match, p1, p2) => {
        if (p1.toLowerCase().includes('text')) return match; // skip text styles
        
        let updated = p2;
        
        // If it's a primary button, make it dark/transparent with a border as requested
        if (updated.includes('backgroundColor: colors.primary')) {
            updated = updated.replace('backgroundColor: colors.primary', 'backgroundColor: colors.card');
            if (!updated.includes('borderWidth')) {
                updated += ",\n    borderWidth: 1,\n    borderColor: colors.border || '#333'";
            }
        }
        
        return `${p1}: {${updated}}`;
      });
      
      // 5. Fix button text color if it was using background color (which is now same as button bg)
      content = content.replace(/(\w*buttonText\w*):\s*{([^}]*)}/gi, (match, p1, p2) => {
          let updated = p2;
          if (updated.includes('color: colors.background')) {
              return `${p1}: {${updated.replace('color: colors.background', 'color: colors.primary')}}`;
          }
          return match;
      });

      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Cleaned: ${file}`);
      }
    });
  });
});
