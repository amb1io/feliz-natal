// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

import htmx from "astro-htmx";

import alpinejs from "@astrojs/alpinejs";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  trailingSlash: "never",

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap(), htmx(), alpinejs()],
});
