const fs = require('fs');
let c = fs.readFileSync('frontend/app/(marketing)/marketing.css', 'utf8');

c = c.replace(/color:#696f83/g, 'color:#8c94a8');
c = c.replace(/color:#687286/g, 'color:#7a859c');
c = c.replace(/color:#505a6c/g, 'color:#717d94');
c = c.replace(/color:#91727a/g, 'color:#a27e87');

fs.writeFileSync('frontend/app/(marketing)/marketing.css', c);
