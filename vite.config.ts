/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { compression } from "vite-plugin-compression2";
import { analyzer } from 'vite-bundle-analyzer'

export default defineConfig(({ mode }) => {
	const isProd = mode === "production";
	// const isPreview = command === 'serve'

	return {
		plugins: [
			preact(),
			// Only add compression in production
			...(isProd
				? [
					compression({
						algorithms: ["gzip", "brotliCompress"],
						threshold: 1024,
					}),
					analyzer(),
				]
				: []),
		],
		define: {
			"process.env": {
				NODE_ENV: JSON.stringify(process.env.NODE_ENV)
			},
		},
		build: {
			lib: {
				entry: "src/main.tsx",
				name: "WebRTCWidget",
				formats: ["cjs"],
				fileName: () => "webRTCWidget.js",
			},
			// Add output directory configuration
			outDir: "dist",
			minify: isProd ? "terser" : false,
			terserOptions: isProd
				? {
					compress: {
						drop_console: true,
						drop_debugger: true,
					},
				}
				: undefined,
			rollupOptions: {
				output: {
					manualChunks: undefined,
					compact: isProd,
					// Force a single file output
					inlineDynamicImports: true,
					// Ensure assets are included in the main bundle
					assetFileNames: "assets/[name][extname]",
					// Specify the exact output format for the main file
					entryFileNames: "webRTCWidget.js",
					// Disable code splitting
					preserveModules: false,
				},
			},
			reportCompressedSize: isProd,
			sourcemap: !isProd,
		},
		server: {
			port: 3000,
			host: true,
			fs: {
				allow: [".."],
			},
			origin: "http://localhost:3000",
			hmr: {
				overlay: true,
			},
			watch: {
				usePolling: true,
			},
		},
		preview: {
			port: 3000,
		},
		test: {
			globals: true,
			environment: "jsdom",
			setupFiles: "./src/spec/setup.ts",
			alias: {
				"react": "preact/compat",
				"react-dom": "preact/compat",
			},
		},
		root: ".",
	};
});
