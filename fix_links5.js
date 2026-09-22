const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/links.spec.ts', 'utf8');

const oldStr = `    await page.screenshot({ path: testInfo.outputPath('breadcrumbs.png'), fullPage: true });
    await home.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('.page-content')?.scrollBy(0, -150));
    await page.waitForTimeout(500); // give it a moment
    await home.click({ force: true });
    await expect(page).toHaveURL(/\\/app$/);`;

const newStr = `    await page.screenshot({ path: testInfo.outputPath('breadcrumbs.png'), fullPage: true });
    await home.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.scrollBy(0, -100);
      document.querySelector('.page-content')?.scrollBy(0, -100);
    });
    await page.waitForTimeout(500);
    await home.click();
    await expect(page).toHaveURL(/\\/app$/);`;

c = c.replace(oldStr, newStr);
c = c.replace(oldStr.replace(/\n/g, '\r\n'), newStr.replace(/\n/g, '\r\n'));
fs.writeFileSync('frontend/tests/e2e/links.spec.ts', c);
