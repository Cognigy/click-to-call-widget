import { useEffect } from "preact/hooks";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

import { WidgetRoot, type WidgetRootProps } from "./WidgetRoot";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";
import { ensureWidgetFontLoaded } from "../helpers";

// Custom key: Emotion's default `css` key collides with Cognigy Webchat's own Emotion instance, so
// whichever loads second adopts/flushes the other's <style> tags, leaving one widget unstyled.
// Module-scope singleton so we don't re-scan/re-adopt our own tags on every initWebRTCWidget() call.
const emotionCache = createCache({ key: EMOTION_CACHE_KEY });

const App = (props: WidgetRootProps) => {
	useEffect(() => {
		ensureWidgetFontLoaded(WIDGET_FONT_HREF);
	}, []);

	return (
		<CacheProvider value={emotionCache}>
			<WidgetRoot {...props} />
		</CacheProvider>
	);
};

export default App;
