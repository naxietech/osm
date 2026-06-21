import React from 'react';

import { Spinner } from '@/design-system/atoms/spinner';
import RouterConfig from '@/router';

export default function App(): React.ReactElement {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <RouterConfig />
    </React.Suspense>
  );
}
