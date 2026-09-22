import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { publicPages } from '../../lib/public-pages';
import * as fs from 'fs';
import * as path from 'path';

const publicRoutes = Object.values(publicPages).map(page => page.path);

test('axe full audit - dump all violations', async ({ page }) => {
  test.setTimeout(600_000);
  const allViolations: any[] = [];

  for (const route of publicRoutes) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const target = node.target.join(' > ');
        const anyData = node.any[0];
        const data = anyData?.data as any;
        allViolations.push({
          page: route,
          ruleId: violation.id,
          impact: violation.impact,
          description: violation.description,
          element: target,
          html: node.html.slice(0, 200),
          fgColor: data?.fgColor ?? 'unknown',
          bgColor: data?.bgColor ?? 'unknown',
          contrastRatio: data?.contrastRatio ?? 'unknown',
          expectedContrastRatio: data?.expectedContrastRatio ?? 'unknown',
          message: node.any[0]?.message ?? node.all[0]?.message ?? node.none[0]?.message ?? '',
        });
      }
    }
  }

  const output = JSON.stringify(allViolations, null, 2);
  const outPath = path.join(__dirname, '..', '..', '..', 'axe-violations.json');
  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`\n=== AXE AUDIT COMPLETE: ${allViolations.length} violations found ===`);
  console.log(`Written to: ${outPath}`);
  console.log(output);
});
