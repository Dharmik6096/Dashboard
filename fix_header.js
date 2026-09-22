const fs = require('fs');
let c = fs.readFileSync('frontend/components/marketing/Header.tsx', 'utf8');

c = c.replace(
  /onClick=\{\(\) \=\> setOpenMenu\(openMenu \=\=\= name \? null \: name\)\} onFocus=\{\(\) \=\> showMenu\(name\)\}/g,
  'onClick={() => setOpenMenu(openMenu === name ? null : name)}'
);

fs.writeFileSync('frontend/components/marketing/Header.tsx', c);
