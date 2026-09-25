import { useEffect } from "preact/hooks";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

import { WidgetRoot, type WidgetRootProps } from "./WidgetRoot";
import { EMOTION_CACHE_KEY, WIDGET_FONT_HREF } from "../constants/constants";
import { ensureWidgetFontLoaded } from "../helpers";

/**
 * Private Emotion cache.
 *
 * Emotion defaults to the cache key `css`, and on creation it scans
 * `document.querySelectorAll('style[data-emotion]')` and adopts every tag
 * whose key matches -- pre-marking the other bundle's class hashes as already
 * inserted. Cognigy Webchat (`webchat3.js`) also ships Emotion under the
 * default `css` key, so on a page hosting both widgets whichever loads second
 * takes ownership of the first's `<style>` tags: a later `flush()` then
 * removes styles the other bundle still needs, and colliding hashes are
 * skipped outright. The symptom is a widget that mounts but renders unstyled.
 *
 * A dedicated key gives us our own `<style data-emotion="cognigy-webrtc ...">`
 * tags that no other bundle will claim.
 *
 * Created once at module scope: a cache per mount would re-scan and re-adopt
 * our own tags on every `initWebRTCWidget()` call.
 */
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
