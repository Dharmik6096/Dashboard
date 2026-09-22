const fs = require('fs');

let t = fs.readFileSync('frontend/tests/e2e/public-quality.spec.ts', 'utf8');
t = t.replace(
  `const link = page.locator('header').getByText(label, { exact: true }).last().locator('xpath=ancestor::a[1]');`,
  `const link = page.locator('header').locator('a').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^$\\\\\\\\{\\\\\\\\}()|[\\\\\\\\]\\\\\\\\]/g, '\\\\\\\\$&')) }).last();`
);
fs.writeFileSync('frontend/tests/e2e/public-quality.spec.ts', t);
