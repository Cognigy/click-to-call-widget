import { useEffect } from "preact/hooks";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

import { WebrtcContextProvider } from "./WebrtcContextProvider";
import { DemoPageBackground } from "./DemoPageBackground";
import VoiceBotWidget from "./VoiceBotWidget";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";
import { ensureWidgetFontLoaded } from "../helpers";
import type { IOptions } from "../types/index.ts";

// Module-scope singleton: a cache per mount would re-scan/re-adopt our own tags on every
// initWebRTCWidget() call (see EMOTION_CACHE_KEY).
const emotionCache = createCache({ key: EMOTION_CACHE_KEY });

const App = ({ token, options, mainRef: ref }: { token: string; options: IOptions, mainRef: any }) => {
	useEffect(() => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
	}, []);

	return (
		<CacheProvider value={emotionCache}>
			<WebrtcContextProvider token={token} options={options}>
				<DemoPageBackground />
				<VoiceBotWidget ref={ref} />
			</WebrtcContextProvider>
		</CacheProvider>
	);
};

export default App;
