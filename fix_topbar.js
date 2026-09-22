const fs = require('fs');
let c = fs.readFileSync('frontend/app/globals.css', 'utf8');

c = c.replace(/--topbar-height: 48px;/g, '--topbar-height: 54px;');
c = c.replace(/--topbar-height:58px;/g, '--topbar-height:54px;');

fs.writeFileSync('frontend/app/globals.css', c);
