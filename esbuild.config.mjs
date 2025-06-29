import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copy } from "esbuild-plugin-copy";

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === "production");

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	jsx: "automatic",
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	plugins: [
		copy({
			// 复制以下资源到 dist/assets 目录
			assets: [
				// 复制插件所需的其他文件到 dist 目录
				{ from: ['./manifest.json'], to: ['./manifest.json'], outDir: '.' },
				{ from: ['./styles.css'], to: ['./styles.css'], outDir: '.' },
				
				{ from: ['./themes/**/*'], to: ['./assets/themes'], outDir: '.' },
				{ from: ['./highlights/**/*'], to: ['./assets/highlights'], outDir: '.' },
				{ from: ['./templates/**/*'], to: ['./assets/templates'], outDir: '.' },
				{ from: ['./themes.json'], to: ['./assets/themes.json'], outDir: '.' },
				{ from: ['./highlights.json'], to: ['./assets/highlights.json'], outDir: '.' },
				{ from: ["./css-snippets/black-h2.css"], to: ["./assets/custom.css"], outDir: '' },
			],
			verbose: false, // 输出复制操作的日志
		}),
	],
});



if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}