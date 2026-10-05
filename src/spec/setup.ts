import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/preact";
import { createCanvas } from "canvas";
import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { transferableAbortController } from "node:util";
import { handlers } from "../mocks/handlers";

// jsdom's AbortController is rejected by Node's fetch (undici); use Node's own.
const NodeAbortController = transferableAbortController()
	.constructor as typeof AbortController;
globalThis.AbortController = NodeAbortController;
globalThis.AbortSignal = new NodeAbortController().signal
	.constructor as typeof AbortSignal;

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
afterEach(() => cleanup());

// Emotion's CacheProvider is a React context and cannot render under preact.
vi.mock("@emotion/react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@emotion/react")>()),
	CacheProvider: ({ children }: { children: unknown }) => children,
}));

// MUI icons are React components and don't render under preact in vitest
// (react is only aliased for inlined deps); stub them like the other specs do.
vi.mock("@mui/icons-material/Phone", async () => {
	const { h } = await import("preact");
	return { default: () => h("span", { "data-icon": "Phone" }) };
});
vi.mock("@mui/icons-material/PhoneDisabled", async () => {
	const { h } = await import("preact");
	return { default: () => h("span", { "data-icon": "PhoneDisabled" }) };
});
vi.mock("@mui/icons-material/Mic", async () => {
	const { h } = await import("preact");
	return { default: () => h("span", { "data-icon": "Mic" }) };
});
vi.mock("@mui/icons-material/MicOff", async () => {
	const { h } = await import("preact");
	return { default: () => h("span", { "data-icon": "MicOff" }) };
});

// Newer Node versions ship an experimental global `localStorage` that shadows
// jsdom's and is undefined without --localstorage-file; fall back to in-memory.
if (typeof globalThis.localStorage === "undefined") {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, String(value)),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear(),
		key: (index: number) => [...store.keys()][index] ?? null,
		get length() {
			return store.size;
		},
	});
}
afterEach(() => localStorage.clear());

// Browser APIs jsdom lacks; enough for the widget to run against a fake JsSIP.
class MediaStreamStub {
	private tracks: unknown[];
	constructor(tracks: unknown[] = []) {
		this.tracks = tracks;
	}
	getTracks() {
		return this.tracks;
	}
	getAudioTracks() {
		return this.tracks;
	}
	addTrack(track: unknown) {
		this.tracks.push(track);
	}
}
if (typeof globalThis.MediaStream === "undefined") {
	vi.stubGlobal("MediaStream", MediaStreamStub);
}

class RTCPeerConnectionStub {
	getSenders() {
		return [];
	}
	getReceivers() {
		return [];
	}
	addEventListener() {}
	removeEventListener() {}
	close() {}
}
window.RTCPeerConnection = RTCPeerConnectionStub as unknown as typeof RTCPeerConnection;

Object.defineProperty(navigator, "mediaDevices", {
	configurable: true,
	value: { getUserMedia: vi.fn().mockResolvedValue(new MediaStream()) },
});

HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
HTMLMediaElement.prototype.pause = vi.fn();
HTMLMediaElement.prototype.load = vi.fn();

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock canvas and its context
global.HTMLCanvasElement.prototype.getContext =  ((
	contextId: string
): RenderingContext | null => {
	if (contextId === "2d") {
		return createCanvas(300, 150).getContext(
			"2d"
		) as unknown as CanvasRenderingContext2D;
	}
	return null;
} ) as {
	(
		contextId: "2d",
		options?: CanvasRenderingContext2DSettings
	): CanvasRenderingContext2D | null;
	(
		contextId: "bitmaprenderer",
		options?: ImageBitmapRenderingContextSettings
	): ImageBitmapRenderingContext | null;
	(
		contextId: "webgl",
		options?: WebGLContextAttributes
	): WebGLRenderingContext | null;
	(
		contextId: "webgl2",
		options?: WebGLContextAttributes
	): WebGL2RenderingContext | null;
};
