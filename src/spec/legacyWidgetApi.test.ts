import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { WebRTCClient } from "@cognigy/click-to-call-sdk";

import { createLegacyWidgetApi, type LegacySession } from "../legacy/legacyWidgetApi";

// Just enough of WebRTCClient for the shim: events plus the call methods.
class FakeClient {
	private handlers = new Map<string, Set<(...args: any[]) => void>>();
	// The SDK tags each RTCSession with its session id in `data.sessionId`.
	rawSession: unknown = { data: { sessionId: "s-1" } };
	sendInfo = vi.fn(async (_text: string, _data?: Record<string, unknown>) => {});
	endCall = vi.fn(async () => {});
	mute = vi.fn(async () => {});
	unmute = vi.fn(async () => {});
	sendDTMF = vi.fn(async (_tones: string | number) => {});

	on(event: string, handler: (...args: any[]) => void) {
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event)!.add(handler);
		return this;
	}
	off(event: string, handler: (...args: any[]) => void) {
		this.handlers.get(event)?.delete(handler);
		return this;
	}
	emit(event: string, ...args: any[]) {
		for (const handler of [...(this.handlers.get(event) ?? [])]) handler(...args);
	}
	listenerCount(event: string) {
		return this.handlers.get(event)?.size ?? 0;
	}
	getRawSession() {
		return this.rawSession;
	}
	getState() {
		return { status: "idle", muted: false, session: null };
	}
}

const callSession = (id: string, status = "init") => ({
	id,
	status,
	direction: "outgoing",
	startTime: new Date(),
	duration: 0,
	muted: false,
	localHold: false,
	remoteHold: false,
});

function setup() {
	const client = new FakeClient();
	const widget = createLegacyWidgetApi(client as unknown as WebRTCClient);
	const sessions: LegacySession[] = [];
	widget.on("newRTCSession", (s: LegacySession) => sessions.push(s));
	return { client, widget, sessions };
}

function record(session: LegacySession, names: string[]) {
	const events: string[] = [];
	for (const name of names) session.on(name, () => events.push(name));
	return events;
}

describe("legacy widget API", () => {
	it("maps sessionCreated to newRTCSession and session", () => {
		const { client, widget, sessions } = setup();
		const viaSession: LegacySession[] = [];
		widget.on("session", (s: LegacySession) => viaSession.push(s));

		client.emit("sessionCreated", callSession("s-1"));

		expect(sessions).toHaveLength(1);
		expect(viaSession).toEqual(sessions);
		expect(sessions[0].id).toBe("s-1");
		expect(sessions[0].status).toBe("init");
		expect(sessions[0].jssipRtcSession).toBe(client.rawSession);
	});

	it("forwards accepted alongside answered", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const events = record(sessions[0], ["ringing", "answered", "accepted", "change"]);

		client.emit("ringing", callSession("s-1", "ringing"));
		client.emit("answered", callSession("s-1", "answered"));

		// Same order as the old SipSession: change first.
		expect(events).toEqual(["change", "ringing", "change", "answered", "accepted"]);
		expect(sessions[0].status).toBe("answered");
	});

	it("forwards terminated alongside ended", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const endInfo = { originator: "local", cause: "Terminated" };
		const ended = vi.fn();
		const terminated = vi.fn();
		sessions[0].on("ended", ended);
		sessions[0].on("terminated", terminated);

		client.emit("ended", callSession("s-1", "ended"), endInfo);

		expect(ended).toHaveBeenCalledWith(endInfo);
		expect(terminated).toHaveBeenCalledWith(endInfo);
		expect(sessions[0].status).toBe("ended");

		// Nothing more is forwarded once the session ended.
		client.emit("infoReceived", { originator: "remote", info: { body: "{}" } });
		client.emit("ended", callSession("s-1", "ended"), endInfo);
		expect(ended).toHaveBeenCalledTimes(1);
	});

	it("forwards failed with the end info", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const failed = vi.fn();
		sessions[0].on("failed", failed);
		const endInfo = { originator: "remote", cause: "Rejected", description: "486" };

		client.emit("failed", callSession("s-1", "failed"), endInfo);

		expect(failed).toHaveBeenCalledWith(endInfo);
		expect(sessions[0].status).toBe("failed");
	});

	it("forwards newInfo and transcription to the current session", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const info = vi.fn();
		const transcription = vi.fn();
		sessions[0].on("newInfo", info);
		sessions[0].on("transcription", transcription);
		const infoPayload = { originator: "remote", info: { body: '{"a":1}' } };
		const transcriptPayload = { originator: "bot", messages: [{ text: "Hi" }] };

		client.emit("infoReceived", infoPayload);
		client.emit("transcription", transcriptPayload);

		expect(info).toHaveBeenCalledWith(infoPayload);
		expect(transcription).toHaveBeenCalledWith(transcriptPayload);
	});

	it("stops forwarding to a session once a newer one starts", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const first = record(sessions[0], ["ringing", "answered", "newInfo", "ended"]);

		client.emit("sessionCreated", callSession("s-2"));
		const second = record(sessions[1], ["ringing", "newInfo"]);
		client.emit("ringing", callSession("s-1", "ringing"));
		client.emit("ringing", callSession("s-2", "ringing"));
		client.emit("infoReceived", { originator: "remote", info: { body: "{}" } });
		client.emit("ended", callSession("s-1", "ended"), {});

		expect(first).toEqual([]);
		expect(second).toEqual(["ringing", "newInfo"]);
	});

	it("jssipRtcSession is the session's own RTCSession, also while a replaced one is still current", () => {
		const { client, sessions } = setup();
		const raw1 = client.rawSession;
		client.emit("sessionCreated", callSession("s-1"));

		// REFER/replaces: s-2 is created while s-1 is still the SDK's current session.
		client.emit("sessionCreated", callSession("s-2"));
		expect(sessions[1].jssipRtcSession).toBeNull();

		const raw2 = { data: { sessionId: "s-2" } };
		client.rawSession = raw2;
		expect(sessions[1].jssipRtcSession).toBe(raw2);
		expect(sessions[0].jssipRtcSession).toBe(raw1);
	});

	it("handler exceptions are swallowed and logged", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		onTestFinished(() => error.mockRestore());
		const { client, widget, sessions } = setup();
		const boom = new Error("boom");
		const after = vi.fn();
		widget.on("connected", () => {
			throw boom;
		});
		widget.on("connected", after);
		widget.on("newRTCSession", () => {
			throw boom;
		});

		expect(() => client.emit("connected")).not.toThrow();
		expect(after).toHaveBeenCalled();
		expect(() => client.emit("sessionCreated", callSession("s-1"))).not.toThrow();
		sessions[0].on("ringing", () => {
			throw boom;
		});
		expect(() => client.emit("ringing", callSession("s-1", "ringing"))).not.toThrow();

		expect(error).toHaveBeenCalledTimes(3);
		expect(error).toHaveBeenCalledWith("[webrtc-widget] legacy handler failed", boom);
	});

	it("registrationFailed payload keeps response.status_code", () => {
		const { client, widget } = setup();
		const handler = vi.fn();
		widget.on("registrationFailed", handler);

		client.emit("registrationFailed", {
			cause: "Rejected",
			response: { status_code: 403, reason_phrase: "Forbidden" },
		});

		expect(handler).toHaveBeenCalledWith({
			cause: "Rejected",
			response: { status_code: 403, reason_phrase: "Forbidden" },
			client,
		});
	});

	it("forwards connecting, connected and disconnected with the client", () => {
		const { client, widget } = setup();
		const calls: [string, unknown][] = [];
		for (const name of ["connecting", "connected", "disconnected"]) {
			widget.on(name, (data: unknown) => calls.push([name, data]));
		}

		client.emit("connecting");
		client.emit("connected");
		client.emit("disconnected", { code: 1006, reason: "gone" });

		expect(calls).toEqual([
			["connecting", { client }],
			["connected", { client }],
			["disconnected", { code: 1006, reason: "gone", client }],
		]);
	});

	it("does not subscribe to the client's error event", () => {
		const { client } = setup();
		expect(client.listenerCount("error")).toBe(0);
	});

	it("session methods delegate to the client and log failures", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		onTestFinished(() => error.mockRestore());
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const session = sessions[0];

		session.sendInfo("Yes", { a: 1 });
		session.sendInfo("No");
		session.terminate(486, "Busy");
		session.mute();
		session.unmute();
		session.sendDtmf("1");

		expect(client.sendInfo).toHaveBeenCalledWith("Yes", { a: 1 });
		expect(client.sendInfo).toHaveBeenCalledWith("No", {});
		expect(client.endCall).toHaveBeenCalledTimes(1);
		expect(client.mute).toHaveBeenCalled();
		expect(client.unmute).toHaveBeenCalled();
		expect(client.sendDTMF).toHaveBeenCalledWith("1");

		client.sendInfo.mockRejectedValueOnce(new Error("not answered"));
		session.sendInfo("late");
		await vi.waitFor(() => expect(error).toHaveBeenCalled());
	});

	it("tracks muted and emits change", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const change = vi.fn();
		sessions[0].on("change", change);

		client.emit("muted", { ...callSession("s-1", "answered"), muted: true });
		expect(sessions[0].muted).toBe(true);
		client.emit("unmuted", callSession("s-1", "answered"));
		expect(sessions[0].muted).toBe(false);
		expect(change).toHaveBeenCalledTimes(2);
	});

	it("session emitter supports once, off and removeListener", () => {
		const { client, sessions } = setup();
		client.emit("sessionCreated", callSession("s-1"));
		const session = sessions[0];
		const once = vi.fn();
		const off = vi.fn();
		const removed = vi.fn();
		session.once("change", once);
		session.on("change", off);
		session.on("change", removed);
		session.off("change", off);
		session.removeListener("change", removed);

		client.emit("ringing", callSession("s-1", "ringing"));
		client.emit("answered", callSession("s-1", "answered"));

		expect(once).toHaveBeenCalledTimes(1);
		expect(off).not.toHaveBeenCalled();
		expect(removed).not.toHaveBeenCalled();
	});
});
