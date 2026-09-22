const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/links.spec.ts', 'utf8');

c = c.replace(
  `    await home.evaluate(node => node.scrollIntoView({block: 'center'}));
    await home.dispatchEvent('click');`,
  `    await home.click();`
);

fs.writeFileSync('frontend/tests/e2e/links.spec.ts', c);
