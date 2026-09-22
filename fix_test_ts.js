const fs = require('fs');
let c = fs.readFileSync('frontend/tests/e2e/public-quality.spec.ts', 'utf8');

c = c.replace(
  `import { test, expect, type Locator, type Page } from './fixture';`,
  `import { test, expect } from './fixture';\nimport { type Locator, type Page } from '@playwright/test';`
);

c = c.replace(
  `toHaveURL(url => url.pathname === expected.pathname && url.hash === expected.hash)`,
  `toHaveURL((url: URL) => url.pathname === expected.pathname && url.hash === expected.hash)`
);

fs.writeFileSync('frontend/tests/e2e/public-quality.spec.ts', c);
