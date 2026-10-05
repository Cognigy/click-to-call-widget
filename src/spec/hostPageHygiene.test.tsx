import { describe, it, expect, beforeEach } from "vitest";

import { ensureWidgetFontLoaded } from "../helpers";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";

/**
 * CGY-36067 host-page hygiene vs. Cognigy Webchat (webchat3.js).
 *
 * The <style data-emotion> tags aren't asserted here: under vitest, @emotion/react resolves
 * real react (preact/compat's rewrite doesn't reach deps), so CacheProvider can't render <App>.
 * Verify the cache key against the built bundle instead:
 *   $ npm run build && grep -c 'key:"cognigy-webrtc"' dist/webRTCWidget.js   # -> 1
 */
describe("host-page hygiene", () => {
	beforeEach(() => {
		for (const node of document.querySelectorAll("link[rel=stylesheet]")) {
			node.remove();
		}
	});

	it("does not use Emotion's default cache key", () => {
		// webchat3.js also claims "css"; sharing it means the two caches adopt each other's tags.
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
