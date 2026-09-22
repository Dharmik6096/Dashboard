const fs = require('fs');
let c = fs.readFileSync('frontend/app/globals.css', 'utf8');

c = c.replace(
  /\.page-content\{padding:18px 20px 28px\}/g,
  '.page-content{padding:18px 20px 28px;scroll-padding-top:calc(var(--topbar-height) + 16px);}'
);

fs.writeFileSync('frontend/app/globals.css', c);
