import { useWebrtcContext } from "./WebrtcContextProvider";
import { useDemoPageBackground } from "../hooks/useDemoPageBackground";
import { useDemoPagePosition } from "../hooks/useDemoPagePosition";

/**
 * Applies demo page background and widget position from config to body
 * when the host page has the cognigy-webrtc-embed class. Renders nothing.
 */
export function DemoPageBackground() {
	const config = useWebrtcContext();
	const demoPage = config?.endpointSettings?.webrtcWidgetConfig?.demoPage;

	useDemoPageBackground(demoPage?.background);
	useDemoPagePosition(demoPage?.position);

	return null;
}
