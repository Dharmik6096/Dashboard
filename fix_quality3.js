const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/public-quality.spec.ts', 'utf8');

const regex1 = /const link = label === 'AI investigations' \? [^;]+;/;
c = c.replace(regex1, 'const link = page.locator(\'header\').locator(`xpath=.//*[text()[1][normalize-space(.)="${label}"]]/ancestor::a[1]`).last();');

fs.writeFileSync('frontend/tests/e2e/public-quality.spec.ts', c);
