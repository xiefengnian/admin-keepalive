import { defineConfig } from "vite"
import { visualizer } from "rollup-plugin-visualizer"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
const pathSrc = resolve(__dirname, "src")
const envPath = resolve(__dirname, "src", ".env")

// https://vitejs.dev/config/
export default defineConfig({
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
                modifyVars: {},
            },
        },
    },
    plugins: [
        visualizer({
            template: "treemap", // or sunburst
            open: false,
            gzipSize: true,
            brotliSize: true,
            filename: "analyse.html", // will be saved in project's root
        }),
        react({
            jsxImportSource: "@emotion/react",
            babel: {
                presets: ["@emotion/babel-preset-css-prop"],
            },
        }),
    ],
    resolve: {
        alias: [
            {
                find: "@/",
                replacement: `${pathSrc}/`,
            },
        ],
    },
})
