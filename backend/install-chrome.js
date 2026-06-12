const { execSync } = require('child_process');
const path = require('path');

if (process.env.RENDER || process.env.NODE_ENV === 'production') {
    process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache/puppeteer');
    console.log(`[Install Chrome] Setting PUPPETEER_CACHE_DIR to: ${process.env.PUPPETEER_CACHE_DIR}`);
}

try {
    console.log('[Install Chrome] Running puppeteer browser installation...');
    execSync('npx puppeteer browsers install chrome', { 
        stdio: 'inherit',
        env: process.env 
    });
    console.log('[Install Chrome] Puppeteer browser installation completed successfully.');
} catch (err) {
    console.error('[Install Chrome] Error installing chrome:', err.message);
    process.exit(1);
}
