import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://lar-ajuda.pt",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: true }),
  ],
  vite: {
    resolve: {
      alias: {
        "~": "/src",
      },
    },
  },
});
