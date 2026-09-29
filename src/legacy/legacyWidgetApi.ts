import type {
	CallEndInfo,
	CallSession,
	ExtendedRTCSession,
	SessionStatus,
	WebRTCClient,
} from "@cognigy/click-to-call-sdk";

type Handler = (...args: any[]) => void;

/** What `initWebRTCWidget` resolves to (and passes to its callback). */
export interface LegacyWidgetApi {
	on(event: string, handler: Handler): void;
}

// UA-level events the old SipClient re-emitted as `{ ...data, client }`.
const CLIENT_EVENTS = ["connecting", "connected", "disconnected", "registrationFailed"] as const;

// Integrator code must never break the widget.
function safeCall(handler: Handler, args: unknown[]): void {
	try {
		handler(...args);
	} catch (e) {
		console.error("[webrtc-widget] legacy handler failed", e);
	}
}

// Minimal emitter; the widget no longer depends on Node's `events`.
class Emitter {
	private handlers = new Map<string, Handler[]>();

	on(event: string, handler: Handler): this {
		this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
		return this;
	}

	off(event: string, handler: Handler): this {
		const list = this.handlers.get(event);
		if (!list) return this;
		const index = list.findIndex((h) => h === handler || (h as OnceHandler).listener === handler);
		if (index !== -1) this.handlers.set(event, list.filter((_, i) => i !== index));
		return this;
	}

	removeListener(event: string, handler: Handler): this {
		return this.off(event, handler);
	}

	once(event: string, handler: Handler): this {
		const wrapper: OnceHandler = (...args) => {
			this.off(event, wrapper);
			handler(...args);
		};
		wrapper.listener = handler;
		return this.on(event, wrapper);
	}

	protected emit(event: string, ...args: unknown[]): void {
		for (const handler of this.handlers.get(event) ?? []) safeCall(handler, args);
	}
}

type OnceHandler = Handler & { listener?: Handler };

function logFailure(action: string) {
	return (e: unknown) => console.error(`[webrtc-widget] legacy session ${action} failed`, e);
}

/**
 * The session object `newRTCSession`/`session` handlers receive, shaped like the
 * old SipSession. Events: ringing, answered + accepted, newInfo, transcription,
 * failed, ended + terminated, change. It only forwards while it is the latest
 * session and until it ends. Its methods always act on the client's current
 * call, also once a newer session has detached it.
 */
export class LegacySession extends Emitter {
	private _status: SessionStatus;
	private _muted: boolean;
	private _done = false;
	private readonly _client: WebRTCClient;
	private readonly _id: string;
	private _rtcSession: ExtendedRTCSession | null = null;

	constructor(client: WebRTCClient, session: CallSession) {
		super();
		this._client = client;
		this._id = session.id;
		this._status = session.status;
		this._muted = session.muted;
		// Captured while it is the client's current one, so it survives the call.
		this._captureRtcSession();
	}

	get id(): string {
		return this._id;
	}

	get status(): SessionStatus {
		return this._status;
	}

	get muted(): boolean {
		return this._muted;
	}

	/**
	 * This session's JsSIP RTCSession, or null while the client's current raw
	 * session is another one (e.g. a REFER/replaces session created while the
	 * replaced call is still active). The SDK has no id-to-session lookup, so
	 * this is read lazily and matched by the `data.sessionId` the SDK tags it with.
	 */
	get jssipRtcSession(): ExtendedRTCSession | null {
		this._captureRtcSession();
		return this._rtcSession;
	}

	private _captureRtcSession(): void {
		if (this._rtcSession) return;
		const raw = this._client.getRawSession();
		if (raw?.data?.sessionId === this._id) this._rtcSession = raw;
	}

	/** Sends `{ text, data }` as application/json INFO; needs an answered call. */
	sendInfo(text: string, data: Record<string, unknown> = {}): void {
		this._client.sendInfo(text, data).catch(logFailure("sendInfo"));
	}

	/**
	 * Ends the call (also while ringing). The SDK always sends 480 "Ended by
	 * user"; custom codes and reasons are ignored.
	 */
	terminate(_code?: number, _reason?: string): void {
		this._client.endCall().catch(logFailure("terminate"));
	}

	mute(): void {
		this._client.mute().catch(logFailure("mute"));
	}

	unmute(): void {
		this._client.unmute().catch(logFailure("unmute"));
	}

	sendDtmf(tones: string | number): void {
		this._client.sendDTMF(tones).catch(logFailure("sendDtmf"));
	}

	/** @internal Stops forwarding; a newer session replaced this one. */
	_detach(): void {
		this._done = true;
	}

	/** @internal */
	_handle(event: string, session: CallSession | null, payload?: unknown): void {
		if (this._done) return;
		if (session && session.id !== this._id) return;
		switch (event) {
			case "ringing":
				this._setStatus("ringing");
				this.emit("ringing");
				break;
			case "answered":
				this._setStatus("answered");
				this.emit("answered");
				this.emit("accepted");
				break;
			case "muted":
			case "unmuted":
				this._muted = event === "muted";
				this.emit("change");
				break;
			case "infoReceived":
				this.emit("newInfo", payload);
				break;
			case "transcription":
				this.emit("transcription", payload);
				break;
			case "failed":
				this._done = true;
				this._setStatus("failed");
				this.emit("failed", payload);
				break;
			case "ended":
				this._done = true;
				this._setStatus("ended");
				this.emit("ended", payload);
				this.emit("terminated", payload);
				break;
		}
	}

	private _setStatus(status: SessionStatus): void {
		this._status = status;
		this.emit("change");
	}
}

class LegacyWidget extends Emitter implements LegacyWidgetApi {
	private current: LegacySession | null = null;

	constructor(client: WebRTCClient | null) {
		super();
		// Without WebRTC there is no client: handlers can be added but never fire.
		if (!client) return;
		for (const name of CLIENT_EVENTS) {
			client.on(name, (data?: object) => this.emit(name, { ...data, client }));
		}
		client.on("sessionCreated", (session) => {
			this.current?._detach();
			const legacy = new LegacySession(client, session);
			this.current = legacy;
			this.emit("newRTCSession", legacy);
			this.emit("session", legacy);
		});
		client.on("ringing", (s) => this.current?._handle("ringing", s));
		client.on("answered", (s) => this.current?._handle("answered", s));
		client.on("muted", (s) => this.current?._handle("muted", s));
		client.on("unmuted", (s) => this.current?._handle("unmuted", s));
		client.on("failed", (s, info: CallEndInfo) => this.current?._handle("failed", s, info));
		client.on("ended", (s, info: CallEndInfo) => this.current?._handle("ended", s, info));
		// INFO events carry no session; they belong to the current one.
		client.on("infoReceived", (data) => this.current?._handle("infoReceived", null, data));
		client.on("transcription", (data) => this.current?._handle("transcription", null, data));
	}
}

/**
 * Builds the pre-SDK widget API (`widget.on(event, handler)`) on top of a
 * WebRTCClient (inert for null). Listeners go away with `client.destroy()`.
 */
export function createLegacyWidgetApi(client: WebRTCClient | null): LegacyWidgetApi {
	return new LegacyWidget(client);
}
