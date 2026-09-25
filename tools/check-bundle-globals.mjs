#!/usr/bin/env node
/**
 * Fails if loading the built bundle adds globals beyond the public API.
 *
 * Customers load webRTCWidget.js with a classic <script>, so everything the
 * bundle declares at top level lands on `window` -- where any other script on
 * the page can overwrite it. That is how CGY-36067 happened: the bundle was
 * built unwrapped, leaked ~490 minified names including Preact's internal `_`,
 * and Webchat's lodash replaced `window._`.
 *
 * The bundle is injected through a real <script> element on purpose.
 * `window.eval()` or `require()` give the code its own scope and would hide
 * exactly the leak this check exists to catch.
 *
 * Usage: node tools/check-bundle-globals.mjs [path/to/webRTCWidget.js]
 */
import fs from "node:fs";
import { JSDOM } from "jsdom";

const file = process.argv[2] ?? "dist/webRTCWidget.js";

const PUBLIC_API = ["initWebRTCWidget", "destroyWebRTCWidget"];
// esbuild's class-field helpers, emitted outside the IIFE for the current
// build target. Uniquely named and semantically identical wherever they
// appear, so harmless.
const TOLERATED = ["__defProp", "__defNormalProp", "__publicField"];
const allowed = new Set([...PUBLIC_API, ...TOLERATED]);

const { window } = new JSDOM(
	"<!doctype html><html><head></head><body></body></html>",
	{ runScripts: "dangerously" }
);
const errors = [];
window.addEventListener("error", (event) => errors.push(event.error ?? event.message));

const before = new Set(Object.getOwnPropertyNames(window));
const script = window.document.createElement("script");
script.textContent = fs.readFileSync(file, "utf8");
window.document.head.appendChild(script);

const added = Object.getOwnPropertyNames(window).filter((name) => !before.has(name));
const unexpected = added.filter((name) => !allowed.has(name));
const missing = PUBLIC_API.filter((name) => typeof window[name] !== "function");

if (errors.length) {
	console.error(`${file}: bundle threw while loading:`, errors[0]);
}
if (unexpected.length) {
	console.error(
		`${file}: ${unexpected.length} unexpected global(s) leaked onto window, e.g. ${unexpected
			.slice(0, 15)
			.join(" ")}\n  -> is vite.config.ts still building a wrapped ("iife") format?`
	);
}
if (missing.length) {
	console.error(`${file}: public API missing from window: ${missing.join(", ")}`);
}

if (errors.length || unexpected.length || missing.length) {
	process.exitCode = 1;
} else {
	console.log(`${file}: OK -- globals added: ${added.join(", ")}`);
}
