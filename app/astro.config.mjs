// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

import htmx from "astro-htmx";

import alpinejs from "@astrojs/alpinejs";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://feliz.natal.br",
  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["htmx.org", "alpinejs"],
    },
  },

  integrations: [sitemap(), htmx(), alpinejs()],
});
