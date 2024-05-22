import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    root: "src/client", // replace with your frontend code dir
    plugins: [
        react() // replace with your plugin
    ],
});