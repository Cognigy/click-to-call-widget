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

	return new Promise<IWidgetInstance>((resolve, reject) => {
		const webrtcWidget = document.createElement("div");
		document.body.appendChild(webrtcWidget);
		currentWidgetContainer = webrtcWidget;

		const newOptions: IOptions = options ? { ...options } : {};

		let webrtcWidgetRef: IWidgetInstance | null = null;
		// A later init or destroy replaces the container; stop waiting for this one
		// and leave its promise pending (integrators and previews treat a rejection as a failed init).
		const superseded = () => currentWidgetContainer !== webrtcWidget;

		setTimeout(async () => {
			try {
				if (superseded()) return;
				render(<App mainRef={(ref: IWidgetInstance) => {
					webrtcWidgetRef = ref;
				}} token={token} options={newOptions} />, webrtcWidget);
				while (!webrtcWidgetRef) {
					if (superseded()) return;
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				if (superseded()) return;
				if (callback) {
					callback(webrtcWidgetRef);
				}
				resolve(webrtcWidgetRef);
			} catch (error) {
				reject(error);
			}
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
