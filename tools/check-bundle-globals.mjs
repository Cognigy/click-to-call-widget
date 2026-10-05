#!/usr/bin/env node
// CGY-36067: an unwrapped build leaked ~490 names onto window (incl. Preact's `_`, which
// Webchat's lodash then overwrote). Loads via a real <script> -- eval()/require() would
// give the code its own scope and hide the leak.
import fs from "node:fs";
import { JSDOM } from "jsdom";

const file = process.argv[2] ?? "dist/webRTCWidget.js";
const ALLOWED = new Set([
	"initWebRTCWidget",
	"destroyWebRTCWidget",
	// esbuild's class-field helpers for this build target -- harmless.
	"__defProp",
	"__defNormalProp",
	"__publicField",
]);

const { window } = new JSDOM("<!doctype html><html></html>", { runScripts: "dangerously" });
const before = new Set(Object.getOwnPropertyNames(window));
const script = window.document.createElement("script");
script.textContent = fs.readFileSync(file, "utf8");
window.document.head.appendChild(script);

const added = Object.getOwnPropertyNames(window).filter((name) => !before.has(name));
const unexpected = added.filter((name) => !ALLOWED.has(name));

if (unexpected.length) {
	console.error(`${file}: unexpected global(s) leaked onto window: ${unexpected.join(", ")}`);
	process.exit(1);
}
console.log(`${file}: OK -- globals added: ${added.join(", ")}`);
