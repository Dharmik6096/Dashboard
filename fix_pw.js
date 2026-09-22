const fs = require('fs');
let c = fs.readFileSync('frontend/playwright.config.ts', 'utf8');
c = c.replace(/reuseExistingServer: false/g, 'reuseExistingServer: true');
fs.writeFileSync('frontend/playwright.config.ts', c);
