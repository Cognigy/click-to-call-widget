import { useEffect, useLayoutEffect, useMemo } from "preact/hooks";

import { WebrtcContextProvider, useWebrtcContext } from "./WebrtcContextProvider";
import { DemoPageBackground } from "./DemoPageBackground";
import VoiceBotWidget from "./VoiceBotWidget";
import type { IOptions } from "../types/index.ts";
import { createLegacyWidgetApi, type LegacyWidgetApi } from "../legacy/legacyWidgetApi";

type MainRef = (widget: LegacyWidgetApi) => void;

// Hands integrators the legacy widget API as soon as the client exists.
const LegacyApiBridge = ({ mainRef }: { mainRef?: MainRef }) => {
	const client = useWebrtcContext().client;
	const api = useMemo(() => (client ? createLegacyWidgetApi(client) : null), [client]);
	// Layout effect: initWebRTCWidget polls for the ref right after render.
	useLayoutEffect(() => {
		if (api) mainRef?.(api);
	}, [api, mainRef]);
	return null;
};

const App = ({ token, options, mainRef }: { token: string; options: IOptions; mainRef?: MainRef }) => {
	useEffect(() => {
		const font = document.createElement("link");
		font.href =
			"https://fonts.googleapis.com/css2?family=Mulish:wght@600&display=swap";
		font.rel = "stylesheet";
		document.body.appendChild(font);
	}, []);

	return (
		<WebrtcContextProvider token={token} options={options}>
			<DemoPageBackground />
			<LegacyApiBridge mainRef={mainRef} />
			<VoiceBotWidget />
		</WebrtcContextProvider>
	);
};

export default App;
