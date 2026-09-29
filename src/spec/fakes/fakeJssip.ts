import { EventEmitter } from "events";
import { vi } from "vitest";

export class FakeRTCSession extends EventEmitter {
	direction = "outgoing";
	data: Record<string, unknown>;
	_connection: unknown = null;
	connection: unknown = null;
	start_time?: Date;
	remote_identity = { uri: { user: "bot" } };
	private _established = false;
	private _ended = false;
	private _audioMuted = false;

	constructor(options: { data?: Record<string, unknown> } = {}) {
		super();
		this.data = options.data ?? {};
	}

	isEstablished() {
		return this._established;
	}

	isEnded() {
		return this._ended;
	}

	// Real JsSIP throws on an ended session; a silent no-op keeps the fake forgiving.
	terminate = vi.fn((_opts?: unknown) => {
		if (this._ended) return;
		this._ended = true;
		this.emit("ended", { originator: "local", cause: "Terminated" });
	});
	// Like JsSIP: emit only when the audio-muted state actually changes.
	mute = vi.fn((opts: { audio?: boolean } = { audio: true }) => {
		if (!this._audioMuted && opts.audio) {
			this._audioMuted = true;
			this.emit("muted", { audio: true, video: false });
		}
	});
	unmute = vi.fn((opts: { audio?: boolean } = { audio: true }) => {
		if (this._audioMuted && opts.audio) {
			this._audioMuted = false;
			this.emit("unmuted", { audio: true, video: false });
		}
	});
	sendDTMF = vi.fn();
	// The widget puts the session on hold/unhold as it becomes (in)active.
	hold = vi.fn();
	unhold = vi.fn();

	// On the prototype: the widget calls constructor.prototype.sendInfo directly.
	sendInfo(_contentType: string, _body: string) {}

	progress() {
		this.emit("progress", { originator: "remote" });
	}

	accept() {
		this._established = true;
		this.start_time = new Date();
		this.emit("accepted", { originator: "remote" });
		this.emit("confirmed", { originator: "remote" });
	}

	fail(cause: string, statusCode: number) {
		this._ended = true;
		this.emit("failed", {
			originator: "remote",
			cause,
			message: { status_code: statusCode },
		});
	}

	receiveInfo(body: string) {
		this.emit("newInfo", { originator: "remote", info: { body } });
	}
}

export class FakeUA extends EventEmitter {
	static instances: FakeUA[] = [];
	static autoSession = true;

	config: Record<string, any>;
	sessions: FakeRTCSession[] = [];

	constructor(config: Record<string, any>) {
		super();
		this.config = config;
		FakeUA.instances.push(this);
	}

	/** performance.now() of every call() — lets tests assert the INVITE lead-in. */
	callTimestamps: number[] = [];

	private _started = false;
	private _connected = false;
	private _registered = false;

	isConnected() {
		return this._connected;
	}

	isRegistered() {
		return this._registered;
	}

	start = vi.fn(() => {
		this._started = true;
		queueMicrotask(() => {
			this.emit("connecting", {});
		});
		queueMicrotask(() => {
			this._connected = true;
			this.emit("connected", {});
		});
		if (this.config.register !== false) {
			queueMicrotask(() => {
				this._registered = true;
				this.emit("registered", {});
			});
		}
	});

	// Like JsSIP: terminates live sessions, and only a started UA disconnects; the
	// widget calls stop() from its own "disconnected" handler, so an unguarded emit
	// would recurse forever.
	stop = vi.fn(() => {
		for (const session of this.sessions) {
			if (!session.isEnded()) session.terminate();
		}
		if (!this._started) return;
		this._started = false;
		this._connected = false;
		this._registered = false;
		queueMicrotask(() => this.emit("disconnected", {}));
	});

	call = vi.fn(
		(_target: string, options: { data?: Record<string, unknown> } = {}) => {
			this.callTimestamps.push(performance.now());
			const session = new FakeRTCSession(options);
			this.sessions.push(session);
			if (FakeUA.autoSession) {
				this.emit("newRTCSession", { session, originator: "local" });
			}
			return session;
		}
	);
}

export const fakeJssipModule = {
	UA: FakeUA,
	WebSocketInterface: vi.fn(),
	Grammar: { parse: () => null },
	C: {
		causes: {
			CANCELED: "Canceled",
			REJECTED: "Rejected",
			BYE: "Terminated",
			NO_ANSWER: "No Answer",
			EXPIRES: "Expires",
		},
	},
};

export function resetFakeJssip(): void {
	FakeUA.instances = [];
	FakeUA.autoSession = true;
}
