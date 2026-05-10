import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// Public-utility, fully-static. No SSR adapter.
export default defineConfig({
  site: "https://precoslares.pt",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: true }),
    sitemap({
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
      i18n: { defaultLocale: "pt-pt", locales: { "pt-pt": "pt-PT" } },
    }),
  ],
  env: {
    schema: {
      // Optional. When unset, Plausible script is not emitted.
      PLAUSIBLE_DOMAIN: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
    },
  },
  vite: {
    resolve: {
      alias: {
        "~": "/src",
      },
    },
  },
});
