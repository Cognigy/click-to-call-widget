import { useEffect } from "preact/hooks";
import type { IDemoPageBackground } from "../types";
import { DEMO_PAGE_BACKGROUND_TARGET_CLASS } from "../constants/constants";

/**
 * Applies demo page background (color or image) to the body element.
 * Only runs when body has the target class (cognigy-webrtc-embed), ensuring
 * we never override backgrounds on third-party pages.
 */
export function useDemoPageBackground(demoPageBackground: IDemoPageBackground | undefined) {
	useEffect(() => {
		if (!demoPageBackground || !document.body.classList.contains(DEMO_PAGE_BACKGROUND_TARGET_CLASS)) {
			return;
		}

		const { color, imageUrl } = demoPageBackground;
		const mode = demoPageBackground.mode ?? (imageUrl ? "imageUrl" : color ? "color" : undefined);

		if (!mode) return;

		if (mode === "color" && color) {
			document.body.style.backgroundColor = color;
			document.body.style.backgroundImage = "";
			document.body.style.backgroundSize = "";
			document.body.style.backgroundRepeat = "";
			document.body.style.backgroundPosition = "";
		} else if (mode === "imageUrl" && imageUrl) {
			document.body.style.backgroundColor = "";
			document.body.style.backgroundImage = `url("${imageUrl}")`;
			document.body.style.backgroundSize = "cover";
			document.body.style.backgroundRepeat = "no-repeat";
			document.body.style.backgroundPosition = "center";
		}

		return () => {
			if (document.body.classList.contains(DEMO_PAGE_BACKGROUND_TARGET_CLASS)) {
				document.body.style.backgroundColor = "";
				document.body.style.backgroundImage = "";
				document.body.style.backgroundSize = "";
				document.body.style.backgroundRepeat = "";
				document.body.style.backgroundPosition = "";
			}
		};
	}, [demoPageBackground]);
}
