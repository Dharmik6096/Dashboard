const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/links.spec.ts', 'utf8');

const oldStr = `    await page.screenshot({ path: testInfo.outputPath('breadcrumbs.png'), fullPage: true });
    await home.click();
    await expect(page).toHaveURL(/\\/app$/);`;
const newStr = `    await page.screenshot({ path: testInfo.outputPath('breadcrumbs.png'), fullPage: true });
    await home.evaluate(node => node.scrollIntoView({block: 'center'}));
    await home.click();
    await expect(page).toHaveURL(/\\/app$/);`;

c = c.replace(oldStr, newStr);
c = c.replace(oldStr.replace(/\n/g, '\r\n'), newStr.replace(/\n/g, '\r\n'));
fs.writeFileSync('frontend/tests/e2e/links.spec.ts', c);
