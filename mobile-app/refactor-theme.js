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
          if (file.endsWith('.tsx') && !file.includes('node_modules')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const processFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Skip if already refactored
  if (content.includes('useTheme') && content.includes('getStyles')) return;

  // 1. Import ThemeContext
  const relativeDepth = file.split('mobile-app')[1].split(path.sep).length - 2;
  const relativePath = relativeDepth <= 0 ? './context/ThemeContext' : '../'.repeat(relativeDepth) + 'context/ThemeContext';
  
  if (!content.includes('useTheme')) {
    // Inject import near top
    content = content.replace(/import React/, `import { useTheme } from '${relativePath}';\nimport React`);
  }

  // 2. Remove AzureTheme import
  content = content.replace(/import\s*{\s*AzureTheme\s*}\s*from\s*['"].*?['"];\n?/g, '');

  // 3. Update StyleSheet.create
  content = content.replace(/const styles = StyleSheet\.create\({/g, 'const getStyles = (colors: any) => StyleSheet.create({');

  // 4. Inject hooks inside the main component
  // Find the FIRST export function and inject
  let injected = false;
  content = content.replace(/(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*{)/, (match) => {
    injected = true;
    return `${match}\n  const { colors, isDark, setTheme, theme } = useTheme();\n  const styles = getStyles(colors);\n`;
  });

  // 5. Replace AzureTheme.colors
  content = content.replace(/AzureTheme\.colors\./g, 'colors.');

  // 6. Replace hardcoded light colors to use dynamic colors
  content = content.replace(/'#FFFFFF'/g, 'colors.card');
  content = content.replace(/'#F3F4F6'/g, 'colors.background');
  content = content.replace(/'#F8FAFC'/g, 'colors.background');
  content = content.replace(/'#0F172A'/g, 'colors.text');
  content = content.replace(/'#1F2937'/g, 'colors.text');
  content = content.replace(/'#64748B'/g, 'colors.textLight');
  content = content.replace(/'#6B7280'/g, 'colors.textLight');
  content = content.replace(/'#9CA3AF'/g, 'colors.textLight');

  if (content !== originalContent && injected) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Refactored: ${file}`);
  }
};

walk(path.join(__dirname, 'app'), (err, files) => {
  if (err) throw err;
  files.forEach(processFile);
  console.log('App directory refactored!');
});

walk(path.join(__dirname, 'components'), (err, files) => {
  if (err) throw err;
  files.forEach(processFile);
  console.log('Components directory refactored!');
});
