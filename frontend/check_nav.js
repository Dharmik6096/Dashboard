const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8080/integrations');
  
  const link = page.locator('main a.btn-primary').first();
  const href = await link.getAttribute('href');
  console.log('Button href attribute:', href);
  
  const outerHTML = await link.evaluate(el => el.outerHTML);
  console.log('Button outerHTML:', outerHTML);

  await link.click();
  await page.waitForLoadState('networkidle');
  console.log('Final URL:', page.url());
  
  await browser.close();
})();
