import { beforeAll, afterEach, afterAll } from "vitest";
import { cleanup } from "@testing-library/preact";
import { createCanvas } from "canvas";
import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { handlers } from "../mocks/handlers";

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
