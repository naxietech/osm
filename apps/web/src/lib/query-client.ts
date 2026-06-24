import { QueryClient } from '@tanstack/react-query';

/** App-wide React Query client. Server state lives here (not in React state). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
