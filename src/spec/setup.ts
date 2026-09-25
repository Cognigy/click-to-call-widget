import { beforeAll, afterEach, afterAll } from "vitest";
import { cleanup } from "@testing-library/preact";
import { createCanvas } from "canvas";
import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { transferableAbortController } from "node:util";
import { handlers } from "../mocks/handlers";

// jsdom replaces the global AbortController with its own, but `fetch` here is
// Node's (undici), which only accepts Node's AbortSignal. Without this every
// `fetch(url, { signal })` in a test rejects with "Expected signal to be an
// instance of AbortSignal" and the widget's config path is never exercised.
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
