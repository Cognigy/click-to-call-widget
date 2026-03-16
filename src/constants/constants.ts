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
