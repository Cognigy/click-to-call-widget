/** @jsxImportSource preact */
import { render } from "preact";
import App from "./components/WebrtcWidget.tsx";
import type { IOptions, IWidgetInstance } from "./types/index.ts";

const ASYNC_DELAY = process.env.NODE_ENV === "development" ? 500 : 0;

let currentWidgetContainer: HTMLElement | null = null;

// import { worker } from "./mocks/browser";
declare global {
	interface Window {
		initWebRTCWidget: typeof initWebRTCWidget;
		destroyWebRTCWidget: typeof destroyWebRTCWidget;
	}
}

const destroyWebRTCWidget = () => {
	if (currentWidgetContainer) {
		render(null, currentWidgetContainer);
		currentWidgetContainer.remove();
		currentWidgetContainer = null;
	}
};

const initWebRTCWidget = async (token: string, options?: IOptions, callback?: (webrtcWidget: IWidgetInstance) => void) => {
	destroyWebRTCWidget();

	return new Promise<IWidgetInstance>((resolve) => {
		const webrtcWidget = document.createElement("div");
		document.body.appendChild(webrtcWidget);
		currentWidgetContainer = webrtcWidget;

	const newOptions: IOptions = options ? { ...options } : {};

	let webrtcWidgetRef : IWidgetInstance | null = null;

	setTimeout(async() => {
		// destroyWebRTCWidget() or a newer init ran before this timer fired: the container is
		// detached, so mounting here would leave an orphan nothing can unmount.
		if (currentWidgetContainer !== webrtcWidget) return;
		render(<App mainRef={(ref: IWidgetInstance) => {
			webrtcWidgetRef = ref;
		}} token={token} options={newOptions} />, webrtcWidget);
		while (!webrtcWidgetRef) {
			await new Promise(resolve => setTimeout(resolve, 500));
			// Destroyed or superseded while waiting for the widget ref: stop polling, resolve nothing.
			if (currentWidgetContainer !== webrtcWidget) return;
		}
		if(callback) {
			callback(webrtcWidgetRef);
		}
		resolve(webrtcWidgetRef);
	}, ASYNC_DELAY);
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
