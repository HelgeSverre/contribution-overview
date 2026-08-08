import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

function appTrailingSlash(): Plugin {
  const redirectAppRoute = (
    request: { url?: string },
    response: { statusCode: number; setHeader(name: string, value: string): void; end(): void },
    next: () => void,
  ) => {
    const url = new URL(request.url ?? "/", "http://vite.local");
    if (url.pathname !== "/app") {
      next();
      return;
    }

    response.statusCode = 308;
    response.setHeader("Location", `/app/${url.search}`);
    response.end();
  };

  return {
    name: "app-trailing-slash",
    configureServer(server) {
      server.middlewares.use(redirectAppRoute);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectAppRoute);
    },
  };
}

export default defineConfig({
  plugins: [appTrailingSlash()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
});
