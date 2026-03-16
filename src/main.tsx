/** @jsxImportSource preact */
import { render } from "preact";
import App from "./components/WebrtcWidget.tsx";
import type { IOptions } from "./types/index.ts";

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

const initWebRTCWidget = async (token: string, options?: IOptions, callback?: (webrtcWidget: typeof App) => void) => {
	destroyWebRTCWidget();

	return new Promise((resolve) => {
		const webrtcWidget = document.createElement("div");
		document.body.appendChild(webrtcWidget);
		currentWidgetContainer = webrtcWidget;

	const newOptions: IOptions = options ? { ...options } : {};

	let webrtcWidgetRef : typeof App | null = null;

	setTimeout(async() => {
		render(<App mainRef={(ref: typeof App) => {
			webrtcWidgetRef = ref;
		}} token={token} options={newOptions} />, webrtcWidget);
		while (!webrtcWidgetRef) {
			await new Promise(resolve => setTimeout(resolve, 500));
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
