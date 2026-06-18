import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// Public-utility, fully-static. No SSR adapter.
export default defineConfig({
  site: "https://www.precoslares.pt",
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
      // Optional. When unset, the wizard still works but the
      // "Partilhar este preço anonimamente" submit becomes a noop
      // (button shows "(submission desativada)"). Pedro configures
      // a Cloudflare Worker / Vercel Edge Function / Formspree URL
      // when ready to start collecting reports server-side.
      REPORT_ENDPOINT: envField.string({
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
