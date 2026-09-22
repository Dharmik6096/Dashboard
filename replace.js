const fs = require('fs');

function replaceFile(path, search, replaceStr) {
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes(search)) {
    c = c.replace(search, replaceStr);
    fs.writeFileSync(path, c);
    console.log(`Replaced in ${path}`);
  } else {
    console.log(`String not found in ${path}`);
  }
}

replaceFile(
  'frontend/components/marketing/Header.tsx',
  `onClick={() => setOpenMenu(openMenu === name ? null : name)} onFocus={() => showMenu(name)} aria-expanded={openMenu === name} aria-haspopup="true"`,
  `onClick={() => setOpenMenu(openMenu === name ? null : name)} aria-expanded={openMenu === name} aria-haspopup="true"`
);

let css = fs.readFileSync('frontend/app/(marketing)/marketing.css', 'utf8');
css = css.replace(/color:#696f83/g, 'color:#8c94a8');
css = css.replace(/color:#687286/g, 'color:#7a859c');
css = css.replace(/color:#505a6c/g, 'color:#717d94');
css = css.replace(/color:#91727a/g, 'color:#a27e87');
fs.writeFileSync('frontend/app/(marketing)/marketing.css', css);

let css2 = fs.readFileSync('frontend/app/globals.css', 'utf8');
css2 = css2.replace(/--topbar-height: 48px;/g, '--topbar-height: 54px;');
css2 = css2.replace(/--topbar-height:58px;/g, '--topbar-height:54px;');
fs.writeFileSync('frontend/app/globals.css', css2);
