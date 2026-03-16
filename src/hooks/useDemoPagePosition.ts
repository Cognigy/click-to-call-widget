import { useEffect } from "preact/hooks";
import type { TWebrtcWidgetPosition } from "../types";
import { DEMO_PAGE_BACKGROUND_TARGET_CLASS } from "../constants/constants";

const POSITION_CLASS_MAP: Record<TWebrtcWidgetPosition, string> = {
	centered: "webrtc-position-centered",
	bottomRight: "webrtc-position-bottomRight",
};

/**
 * Toggles a CSS class on the body element to control widget positioning.
 * Only runs when body has the cognigy-webrtc-embed class.
 * Defaults to "centered" when no position is specified.
 */
export function useDemoPagePosition(position: TWebrtcWidgetPosition | undefined) {
	useEffect(() => {
		if (!document.body.classList.contains(DEMO_PAGE_BACKGROUND_TARGET_CLASS)) {
			return;
		}

		const resolved = position ?? "centered";
		const activeClass = POSITION_CLASS_MAP[resolved];
		const allClasses = Object.values(POSITION_CLASS_MAP);

		for (const cls of allClasses) {
			if (cls === activeClass) {
				document.body.classList.add(cls);
			} else {
				document.body.classList.remove(cls);
			}
		}

		return () => {
			for (const cls of allClasses) {
				document.body.classList.remove(cls);
			}
		};
	}, [position]);
}
