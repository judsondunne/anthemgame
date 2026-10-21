import { defineConfig } from "vite";
export default defineConfig({
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: "index.html",
        garden: "three.html",
        contact: "contact.html",
      },
    },
  },
});
