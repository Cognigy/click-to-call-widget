import { describe, it, expect, beforeEach } from "vitest";

import { ensureWidgetFontLoaded } from "../helpers";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";

/**
 * CGY-36067 -- host-page hygiene when the widget shares a page with Cognigy
 * Webchat (`webchat3.js`).
 *
 * KNOWN TEST-ENVIRONMENT LIMITATION: the `<style data-emotion>` tags are not
 * asserted here. `@preact/preset-vite` rewrites `react` to `preact/compat` for
 * the build, but that rewrite does not reach dependencies under vitest, so
 * `@emotion/react` resolves the real `react` in this environment and its
 * `CacheProvider` comes back as a React context object rather than a Preact
 * component -- rendering `<App>` at all fails here. Neither `resolve.alias`
 * nor `test.server.deps.inline` moved it, so the cache wiring is verified
 * against the built bundle instead:
 *
 *   $ npm run build
 *   $ grep -c 'key:"cognigy-webrtc"' dist/webRTCWidget.js   # -> 1
 *
 * What is asserted below is the environment-independent part.
 */
describe("host-page hygiene", () => {
	beforeEach(() => {
		for (const node of document.querySelectorAll("link[rel=stylesheet]")) {
			node.remove();
		}
	});

	it("does not use Emotion's default cache key", () => {
		// `css` is the key webchat3.js claims; sharing it means the two caches
		// adopt each other's <style> tags.
		expect(EMOTION_CACHE_KEY).not.toBe("css");
		expect(EMOTION_CACHE_KEY).toBe("cognigy-webrtc");
	});

	it("adds the widget font to <head>, never <body>", () => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);

		expect(
			document.head.querySelector(`link[href="${WIDGET_FONT_HREF}"]`)
		).not.toBeNull();
		// It used to be appended to document.body.
		expect(
			document.body.querySelector(`link[href="${WIDGET_FONT_HREF}"]`)
		).toBeNull();
	});

	it("adds the widget font at most once, across repeated mounts", () => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);

		expect(
			document.querySelectorAll(`link[href="${WIDGET_FONT_HREF}"]`)
		).toHaveLength(1);
	});
});
