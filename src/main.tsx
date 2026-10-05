/** @jsxImportSource preact */
import { render } from "preact";
import App from "./components/WebrtcWidget.tsx";
import { WidgetErrorBoundary } from "./components/WidgetErrorBoundary.tsx";
import type { IOptions, IWidgetInstance } from "./types/index.ts";

const ASYNC_DELAY = process.env.NODE_ENV === "development" ? 500 : 0;

// Bounds how long init waits for mount + config load before rejecting, so a slow network never hangs the host page.
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

// A container left mounted *and* referenced is what made every later init re-enter the same broken tree, unrecoverable without a reload.
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

// Aborts a still-pending init so a newer init/destroy doesn't leave its mount timer running against a discarded container.
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

// async so even a missing document.body (script run in <head>) can't throw synchronously -- every failure becomes a rejection.
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
				// Already resolved: no promise left to reject, so report instead of letting it vanish silently.
				reportUncaught(error);
				return;
			}
			finish();
			// Deferred: fail() can run inside componentDidCatch, and re-entering render() on that root isn't safe yet.
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
