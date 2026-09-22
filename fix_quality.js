const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/public-quality.spec.ts', 'utf8');

const oldStr = `const link = page.locator('header').getByText(label, { exact: true }).last().locator('xpath=ancestor::a[1]');`;
const newStr = `const link = page.locator('header').locator(\`xpath=.//strong/text()[1][normalize-space(.)="\${label}"]/ancestor::a[1]\`).last();`;

c = c.replace(oldStr, newStr);
fs.writeFileSync('frontend/tests/e2e/public-quality.spec.ts', c);
