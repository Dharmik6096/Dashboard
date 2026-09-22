const fs = require('fs');
let c = fs.readFileSync('frontend/playwright.config.ts', 'utf8');
c = c.replace(/reuseExistingServer: true/g, 'reuseExistingServer: false');
fs.writeFileSync('frontend/playwright.config.ts', c);
