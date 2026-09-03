import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import "../main";
import App from "../components/WebrtcWidget.tsx";
import type { IWidgetInstance } from "../types/index.ts";

/**
 * Regression tests for CGY-36067.
 *
 * `initWebRTCWidget()` used to be unable to report failure at all: the promise
 * was created with only `resolve`, `render()` ran inside a `setTimeout` (so a
 * throw escaped as an uncaught exception rather than a rejection), and a
 * `while (!ref) await sleep(500)` loop spun forever whenever the widget never
 * fulfilled `mainRef`. A failed mount also left `currentWidgetContainer`
 * populated, so every later init re-entered the broken tree.
 *
 * `App` is mocked per-test so each mount behaviour can be driven directly.
 */
vi.mock("../components/WebrtcWidget.tsx", () => ({
	default: vi.fn(() => null),
}));

const mockedApp = vi.mocked(App) as unknown as ReturnType<typeof vi.fn>;

/** Mount successfully, fulfilling `mainRef` the way the real widget does. */
const mountsSuccessfully = () => {
	mockedApp.mockImplementation(({ mainRef }: any) => {
		mainRef?.({ on: vi.fn(), updateSettings: vi.fn() } as IWidgetInstance);
		return null;
	});
};

/** Render throws, as it did when the Preact tree was in a bad state. */
const throwsOnMount = (message = "boom") => {
	mockedApp.mockImplementation(() => {
		throw new Error(message);
	});
};

/** Renders fine but never fulfils `mainRef` (the `!active` early-return case). */
const neverFulfilsRef = () => {
	mockedApp.mockImplementation(() => null);
};

describe("initWebRTCWidget lifecycle", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mountsSuccessfully();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = "";
	});

	it("resolves with the widget instance once mainRef is fulfilled", async () => {
		const promise = window.initWebRTCWidget("test-token");
		await vi.advanceTimersByTimeAsync(0);

		const instance = await promise;
		expect(instance).toHaveProperty("on");
		expect(instance).toHaveProperty("updateSettings");
	});

	it("invokes the callback with the same instance it resolves with", async () => {
		const callback = vi.fn();
		const promise = window.initWebRTCWidget("test-token", undefined, callback);
		await vi.advanceTimersByTimeAsync(0);

		const instance = await promise;
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith(instance);
	});

	// NOTE: attach the rejection assertion *before* advancing timers. The
	// promise rejects inside `advanceTimersByTimeAsync`, and a rejection with
	// no handler attached by the end of that microtask turn is reported as an
	// unhandled rejection even though the test later awaits it.
	it("rejects instead of throwing uncaught when the mount throws", async () => {
		throwsOnMount("render exploded");
		const promise = window.initWebRTCWidget("test-token");
		const assertion = expect(promise).rejects.toThrow("render exploded");

		await vi.advanceTimersByTimeAsync(0);
		await assertion;
	});

	it("rejects rather than hanging when the widget never fulfils mainRef", async () => {
		neverFulfilsRef();
		const promise = window.initWebRTCWidget("test-token");
		const assertion = expect(promise).rejects.toThrow(/did not mount within/);

		await vi.advanceTimersByTimeAsync(20_000);
		await assertion;
	});

	it("removes the container when init fails, so nothing is left in the DOM", async () => {
		throwsOnMount();
		const promise = window.initWebRTCWidget("test-token");
		const assertion = expect(promise).rejects.toThrow();

		await vi.advanceTimersByTimeAsync(0);
		await assertion;

		expect(document.body.children).toHaveLength(0);
	});

	it("recovers on the next init after a failed one", async () => {
		throwsOnMount();
		const failing = window.initWebRTCWidget("test-token");
		const failingAssertion = expect(failing).rejects.toThrow();

		await vi.advanceTimersByTimeAsync(0);
		await failingAssertion;

		mountsSuccessfully();
		const retry = window.initWebRTCWidget("test-token");
		await vi.advanceTimersByTimeAsync(0);

		await expect(retry).resolves.toHaveProperty("on");
		expect(document.body.children).toHaveLength(1);
	});

	it("settles once even if the callback throws", async () => {
		const callback = vi.fn(() => {
			throw new Error("embedder bug");
		});
		const promise = window.initWebRTCWidget("test-token", undefined, callback);
		await vi.advanceTimersByTimeAsync(0);

		await expect(promise).resolves.toHaveProperty("on");
	});

	it("replaces a previous widget rather than stacking containers", async () => {
		const first = window.initWebRTCWidget("test-token");
		await vi.advanceTimersByTimeAsync(0);
		await first;

		const second = window.initWebRTCWidget("test-token");
		await vi.advanceTimersByTimeAsync(0);
		await second;

		expect(document.body.children).toHaveLength(1);
	});

	it("destroyWebRTCWidget removes the container and is safe to call twice", async () => {
		const promise = window.initWebRTCWidget("test-token");
		await vi.advanceTimersByTimeAsync(0);
		await promise;
		expect(document.body.children).toHaveLength(1);

		window.destroyWebRTCWidget();
		expect(document.body.children).toHaveLength(0);

		expect(() => window.destroyWebRTCWidget()).not.toThrow();
	});
});
