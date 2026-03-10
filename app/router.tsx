import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";
import { PageSpinner } from "./components/page-spinner";

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL!;

  const convexClient = new ConvexReactClient(CONVEX_URL);
  const convexQueryClient = new ConvexQueryClient(convexClient);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: "intent",
      defaultPendingComponent: PageSpinner,
      defaultPendingMs: 150,
      defaultPendingMinMs: 300,
      context: { queryClient, convexClient, convexQueryClient },
      scrollRestoration: true,
      InnerWrap: ({ children }) => (
        <ClerkProvider>
          <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
            {children}
          </ConvexProviderWithClerk>
        </ClerkProvider>
      ),
    }),
    queryClient,
  );

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
