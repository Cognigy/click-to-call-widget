import type { EventName, WebRTCClient } from "@cognigy/click-to-call-sdk";

type Handler = (...args: any[]) => void;

// Connection events that used to pass an object; keep that so `({ code })` handlers don't throw.
const CONNECTION_EVENTS = new Set<string>(["connecting", "connected", "disconnected"]);

// Pre-SDK session events: sessions are no longer wrapped per call.
const REMOVED_EVENTS = new Set<string>(["newRTCSession", "session"]);

/**
 * `widget.on(event, handler)`: subscribes to the SDK client's events by their SDK names.
 * Inert without WebRTC. Listeners go away with `client.destroy()`.
 */
export function createWidgetOn(client: WebRTCClient | null) {
	return (event: string, handler: Handler): void => {
		if (REMOVED_EVENTS.has(event)) {
			console.warn(
				`[webrtc-widget] widget.on("${event}") is no longer supported; use "sessionCreated" and the other @cognigy/click-to-call-sdk events`
			);
			return;
		}
		if (!client) return;
		const listener = CONNECTION_EVENTS.has(event)
			? (data?: object) => handler({ ...data })
			: handler;
		client.on(event as EventName, listener as never);
	};
}
