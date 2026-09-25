/** @jsxImportSource preact */
import { render } from "preact";
import App from "./components/WebrtcWidget.tsx";
import { WidgetErrorBoundary } from "./components/WidgetErrorBoundary.tsx";
import type { IOptions, IWidgetInstance } from "./types/index.ts";

const ASYNC_DELAY = process.env.NODE_ENV === "development" ? 500 : 0;

/**
 * Upper bound on how long `initWebRTCWidget()` waits for the widget to become
 * ready (mounted and endpoint config loaded) before rejecting. Generous enough
 * to cover a slow config fetch on a poor connection, short enough that an
 * embedding page is never left waiting indefinitely.
 */
const INIT_TIMEOUT_MS = 15_000;

let currentWidgetContainer: HTMLElement | null = null;

// import { worker } from "./mocks/browser";
declare global {
	interface Window {
		initWebRTCWidget: (
			token: string,
			options?: IOptions,
			callback?: (widget: IWidgetInstance) => void
		) => Promise<IWidgetInstance>;
		destroyWebRTCWidget: typeof destroyWebRTCWidget;
	}
}

/**
 * Takes a container out of the page and forgets it, synchronously, and never
 * throws. The next `initWebRTCWidget()` must always start clean -- a container
 * left mounted *and* referenced by `currentWidgetContainer` is what made every
 * later init re-enter the same broken tree, so a bounded retry loop could
 * never recover and only a page reload helped.
 */
const detachContainer = (container: HTMLElement) => {
	container.remove();
	if (currentWidgetContainer === container) {
		currentWidgetContainer = null;
	}
};

/** Unmounts a container's Preact tree. Unmounting a half-committed tree can itself throw. */
const unmountQuietly = (container: HTMLElement) => {
	try {
		render(null, container);
	} catch (error) {
		console.error(
			"[WebRTCWidget] failed to unmount cleanly; discarding the container anyway",
			error
		);
	}
};

const teardownContainer = (container: HTMLElement) => {
	unmountQuietly(container);
	detachContainer(container);
};

/**
 * Settles the `initWebRTCWidget()` call that is still waiting, if any. A newer
 * init (or a destroy) must not leave the older one's mount timer running: it
 * would render into the discarded container and resolve with a widget nothing
 * can ever tear down.
 */
let abortPendingInit: ((error: Error) => void) | null = null;

const destroyWebRTCWidget = () => {
	if (abortPendingInit) {
		const error = new Error(
			"[WebRTCWidget] initWebRTCWidget() was superseded by destroyWebRTCWidget() or a newer initWebRTCWidget() call"
		);
		error.name = "AbortError";
		abortPendingInit(error);
	}
	if (currentWidgetContainer) {
		teardownContainer(currentWidgetContainer);
	}
};

/** Rethrows outside the widget so the host page's window.onerror / Sentry sees it. */
const reportUncaught = (error: Error) => {
	setTimeout(() => {
		throw error;
	});
};

// `async` so that nothing -- not even `document.body` being missing when the
// script runs in <head> -- can throw synchronously: every failure is a rejection.
const initWebRTCWidget = async (
	token: string,
	options?: IOptions,
	callback?: (webrtcWidget: IWidgetInstance) => void
): Promise<IWidgetInstance> => {
	destroyWebRTCWidget();

	const container = document.createElement("div");
	document.body.appendChild(container);
	currentWidgetContainer = container;

	const newOptions: IOptions = options ? { ...options } : {};

	return new Promise<IWidgetInstance>((resolve, reject) => {
		let settled = false;

		const mountDelayTimer = setTimeout(() => {
			try {
				render(
					<WidgetErrorBoundary onError={fail}>
						<App
							mainRef={(instance: IWidgetInstance | null) => {
								if (instance) succeed(instance);
							}}
							onError={fail}
							token={token}
							options={newOptions}
						/>
					</WidgetErrorBoundary>,
					container
				);
			} catch (error) {
				fail(error instanceof Error ? error : new Error(String(error)));
			}
		}, ASYNC_DELAY);

		const initTimeoutTimer = setTimeout(() => {
			fail(
				new Error(
					`[WebRTCWidget] widget did not become ready within ${INIT_TIMEOUT_MS}ms`
				)
			);
		}, INIT_TIMEOUT_MS);

		const abortThis = (error: Error) => fail(error);
		abortPendingInit = abortThis;

		const finish = () => {
			settled = true;
			clearTimeout(mountDelayTimer);
			clearTimeout(initTimeoutTimer);
			if (abortPendingInit === abortThis) {
				abortPendingInit = null;
			}
		};

		function succeed(instance: IWidgetInstance) {
			if (settled) return;
			finish();

			// A throwing callback is the embedder's bug, not ours -- report it but
			// still resolve, so one bad listener cannot make init look like a failure.
			if (callback) {
				try {
					callback(instance);
				} catch (error) {
					console.error("[WebRTCWidget] init callback threw", error);
				}
			}
			resolve(instance);
		}

		function fail(error: Error) {
			if (settled) {
				// The widget broke after init resolved. There is no promise left to
				// reject, and the error boundary has already stopped rendering, so
				// without this the widget would just vanish without a trace
				// (production builds also drop console output).
				reportUncaught(error);
				return;
			}
			finish();
			// Leave nothing behind for the next init() -- but unmount on a later
			// tick: `fail` can be called from inside a render (the error boundary's
			// componentDidCatch), and re-entering render() on the root that is
			// still being rendered is not safe.
			detachContainer(container);
			setTimeout(() => unmountQuietly(container));
			reject(error);
		}
	});
};

// Export for both module and global usage
if (typeof window !== "undefined") {
	window.initWebRTCWidget = initWebRTCWidget;
	window.destroyWebRTCWidget = destroyWebRTCWidget;
}

if (process.env.NODE_ENV === "development") {
	import("./mocks/browser").then(({ worker }) => {
		worker.start();
	});
}
