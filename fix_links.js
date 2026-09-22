const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/links.spec.ts', 'utf8');

const oldStr = `  const failures: string[] = [];
  for (const target of targets) {
    if (!matchesRoute(target)) { failures.push(\`Missing route: \${target}\`); continue; }
    const response = await page.goto(target);
    if (!response || response.status() >= 400) failures.push(\`HTTP \${response?.status()}: \${target}\`);
    const hash = new URL(target, 'http://127.0.0.1:3105').hash.slice(1);
    if (hash && !await page.evaluate(id => !!document.getElementById(decodeURIComponent(id)), hash)) {
      failures.push(\`Missing anchor: \${target}\`);
    }
  }`;

const newStr = `  const failures: string[] = [];
  let currentPath = '';
  for (const target of targets) {
    if (!matchesRoute(target)) { failures.push(\`Missing route: \${target}\`); continue; }
    
    const targetUrl = new URL(target, 'http://127.0.0.1:3105');
    const targetPath = targetUrl.pathname;
    const isSamePage = currentPath === targetPath;
    const hash = targetUrl.hash.slice(1);
    
    const response = await page.goto(target);
    if (!isSamePage && !response) failures.push(\`HTTP null: \${target}\`);
    if (response && response.status() >= 400) failures.push(\`HTTP \${response.status()}: \${target}\`);
    currentPath = targetPath;
    
    if (hash) {
      if (!await page.evaluate(id => !!document.getElementById(decodeURIComponent(id)), hash)) {
        failures.push(\`Missing anchor: \${target}\`);
      }
    }
  }`;

c = c.replace(oldStr, newStr);
c = c.replace(oldStr.replace(/\n/g, '\r\n'), newStr.replace(/\n/g, '\r\n'));
fs.writeFileSync('frontend/tests/e2e/links.spec.ts', c);
