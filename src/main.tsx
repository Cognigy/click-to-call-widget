/** @jsxImportSource preact */
import { render } from "preact";
import App from "./components/WebrtcWidget.tsx";
import { WidgetErrorBoundary } from "./components/WidgetErrorBoundary.tsx";
import type { IOptions, IWidgetInstance } from "./types/index.ts";

const ASYNC_DELAY = process.env.NODE_ENV === "development" ? 500 : 0;

/**
 * Upper bound on how long `initWebRTCWidget()` waits for the widget to report
 * itself mounted before rejecting. Generous enough to cover a slow endpoint
 * config fetch on a poor connection, short enough that an embedding page is
 * never left waiting indefinitely.
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
 * Unmounts and removes one container, and never throws.
 *
 * Unmounting a half-committed Preact tree can itself throw. If that were
 * allowed to propagate, the container would stay in the DOM *and* stay
 * referenced by `currentWidgetContainer`, so every later `initWebRTCWidget()`
 * call would re-enter the same broken tree and fail again -- which is why a
 * bounded retry loop could never recover and only a page reload helped.
 */
const teardownContainer = (container: HTMLElement) => {
	try {
		render(null, container);
	} catch (error) {
		console.error(
			"[WebRTCWidget] failed to unmount cleanly; discarding the container anyway",
			error
		);
	} finally {
		container.remove();
		if (currentWidgetContainer === container) {
			currentWidgetContainer = null;
		}
	}
};

const destroyWebRTCWidget = () => {
	if (currentWidgetContainer) {
		teardownContainer(currentWidgetContainer);
	}
};

const initWebRTCWidget = (
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
					`[WebRTCWidget] widget did not mount within ${INIT_TIMEOUT_MS}ms`
				)
			);
		}, INIT_TIMEOUT_MS);

		const clearTimers = () => {
			clearTimeout(mountDelayTimer);
			clearTimeout(initTimeoutTimer);
		};

		function succeed(instance: IWidgetInstance) {
			if (settled) return;
			settled = true;
			clearTimers();

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
			if (settled) return;
			settled = true;
			clearTimers();
			// Leave nothing mounted behind: the next init() must start clean.
			teardownContainer(container);
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
