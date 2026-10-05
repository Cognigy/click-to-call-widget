import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/preact";

import App from "../components/WebrtcWidget";
import { ensureWidgetFontLoaded } from "../helpers";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";

// Records the cache the widget hands to CacheProvider. A real one cannot render under preact
// in vitest, so this is a passthrough that checks the wiring, not the emitted tags.
const providedCaches = vi.hoisted(() => [] as Array<{ key: string }>);
vi.mock("@emotion/react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@emotion/react")>()),
	CacheProvider: ({ value, children }: { value: { key: string }; children: unknown }) => {
		providedCaches.push(value);
		return children;
	},
}));

// CGY-36067 host-page hygiene vs. Cognigy Webchat (webchat3.js).
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

	it("renders the widget inside a CacheProvider with its own cache", () => {
		render(<App token="/cfg" options={{}} mainRef={() => {}} />);

		expect(providedCaches.length).toBeGreaterThan(0);
		expect(providedCaches.every((cache) => cache.key === EMOTION_CACHE_KEY)).toBe(true);
	});

	it("adds the widget font to <head>, never <body>", () => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);

		expect(document.head.querySelector(`link[href="${WIDGET_FONT_HREF}"]`)).not.toBeNull();
		expect(document.body.querySelector(`link[href="${WIDGET_FONT_HREF}"]`)).toBeNull();
	});

	it("adds the widget font at most once, across repeated mounts", () => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);

		expect(document.querySelectorAll(`link[href="${WIDGET_FONT_HREF}"]`)).toHaveLength(1);
	});
});
