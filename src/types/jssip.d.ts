declare module "jssip/lib/RTCSession/ReferSubscriber" {
	import type { EventHandlers } from "jssip";

	export default class RTCSession_ReferSubscriber {
		on(
			event: "requestFailed" | "accepted" | "failed",
			handler: EventHandlers[keyof EventHandlers]
		): RTCSession_ReferSubscriber;
	}
}
