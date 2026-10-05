import { useEffect, useLayoutEffect, useMemo } from "preact/hooks";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

import { WebrtcContextProvider, useWebrtcContext, useWebrtcDispatch } from "./WebrtcContextProvider";
import { DemoPageBackground } from "./DemoPageBackground";
import VoiceBotWidget from "./VoiceBotWidget";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";
import { ensureWidgetFontLoaded } from "../helpers";
import { ActionTypes, type IOptions, type IUpdateableSettings, type IWidgetInstance } from "../types/index.ts";
import { createLegacyWidgetApi } from "../legacy/legacyWidgetApi";

// Module-scope singleton: a cache per mount would re-scan/re-adopt our own tags on every
// initWebRTCWidget() call (see EMOTION_CACHE_KEY).
const emotionCache = createCache({ key: EMOTION_CACHE_KEY });

type MainRef = (widget: IWidgetInstance) => void;

// Hands integrators the widget API on first render; without WebRTC its events are inert.
const LegacyApiBridge = ({ mainRef }: { mainRef?: MainRef }) => {
	const client = useWebrtcContext().client;
	const dispatch = useWebrtcDispatch();
	const api = useMemo<IWidgetInstance>(() => {
		const legacy = createLegacyWidgetApi(client);
		return {
			on: (event, handler) => legacy.on(event, handler),
			updateSettings: (settings: IUpdateableSettings) =>
				dispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: settings }),
		};
	}, [client, dispatch]);
	// Layout effect: initWebRTCWidget polls for the ref right after render.
	useLayoutEffect(() => {
		mainRef?.(api);
	}, [api, mainRef]);
	return null;
};

const App = ({ token, options, mainRef }: { token: string; options: IOptions; mainRef?: MainRef }) => {
	useEffect(() => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
	}, []);

	return (
		<CacheProvider value={emotionCache}>
			<WebrtcContextProvider token={token} options={options}>
				<DemoPageBackground />
				<LegacyApiBridge mainRef={mainRef} />
				<VoiceBotWidget />
			</WebrtcContextProvider>
		</CacheProvider>
	);
};

export default App;
