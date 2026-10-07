// vite.config.js
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [tailwindcss(), sveltekit()],
	server: {
		watch: {
			ignored: ["**/build/**"]
		}
	},
	//removes console.logs in production
	esbuild: {
		drop: ["console", "debugger"]
	},
	ssr: {
		noExternal: ["layercake"]
	}
};

export default config;
