// @ts-check
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

import htmx from "astro-htmx";

import alpinejs from "@astrojs/alpinejs";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
const sharedDir = fileURLToPath(new URL("../shared", import.meta.url));

export default defineConfig({
  site: "https://feliz.natal.br",
  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        allow: [sharedDir],
      },
    },
  },

  integrations: [sitemap(), htmx(), alpinejs()],
});
