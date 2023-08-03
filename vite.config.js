import {defineConfig} from "vite";
import {fileURLToPath, URL} from "url";

////////////////////////////////////////////////////////////////////////////////

export default defineConfig(({mode}) => ({
	// Build using relative paths
	base: "./",

	// Change project root (i.e. index.html) to src folder
	root: "src",
	// Look for env files in parent folder of project root
	envDir: "../",
	// Files in public folder will be copied as-is into build folder
	publicDir: "../public",

	build: {
		// Output build to different folder when building for dev vs prod
		outDir: (mode === "production") ? "../dist" : "../dist-dev",
		// Clear the output directory before building
		emptyOutDir: true,
		sourcemap: true
	},

	resolve: {
		alias: {
			// Alias "~" as the src folder
			"~": fileURLToPath(new URL("./src", import.meta.url))
		}
	}
}));