'use client';

import { PageTransition } from './PageTransition';

export function RouteLoading() {
  return <PageTransition><section role="status" aria-live="polite" aria-busy="true" style={{ padding: 32 }}>
    <p>Loading page...</p>
  </section></PageTransition>;
}

export function RouteError({ retry }: { retry: () => void }) {
  return <PageTransition><section role="alert" style={{ padding: 32 }}>
    <h2>This page could not be loaded</h2>
    <p>Try loading the page again.</p>
    <button className="btn btn-secondary" onClick={retry}>Try again</button>
  </section></PageTransition>;
}
