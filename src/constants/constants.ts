export const CALL_PRIVACY_PERMISSION_KEY = "call-privacy-permission-granted";

export const COGNIGY_WEBRTC_OPTIONS = "cognigy-webrtc-options";

/**
 * Body class that host pages must add when integrating the WebRTC widget
 * to allow demo page background (color/image) styling. Without this class,
 * the widget will never override page backgrounds (safe for third-party pages).
 */
export const DEMO_PAGE_BACKGROUND_TARGET_CLASS = "cognigy-webrtc-embed";

/**
 * Height of the transcript/connecting-message area (in px).
 * Changing this single value resizes both the transcript container
 * and the "connecting" placeholder to keep them aligned.
 */
export const TRANSCRIPT_AREA_HEIGHT = 220;

/**
 * Emotion cache key for the widget's generated styles.
 *
 * Must NOT be Emotion's default (`css`): Cognigy Webchat also bundles Emotion
 * under that key, and on a page hosting both widgets the two caches fight over
 * the same `<style data-emotion="css ...">` tags. See the comment in
 * `WebrtcWidget.tsx`.
 */
export const EMOTION_CACHE_KEY = "cognigy-webrtc";

/** Web font the widget loads once per page, into <head>. */
export const WIDGET_FONT_HREF =
	"https://fonts.googleapis.com/css2?family=Mulish:wght@600&display=swap";
