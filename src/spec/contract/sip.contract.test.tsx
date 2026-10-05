import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/preact";
import * as sounds from "../../constants/sounds";
import { FakeRTCSession, FakeUA, resetFakeJssip } from "../fakes/fakeJssip";
import {
	clickCall,
	clickEnd,
	clickMute,
	lastSession,
	lastUA,
	legacyConfig,
	mountWidget,
	runtimeConfig,
	serveConfig,
} from "./harness";
import "../../main";

vi.mock("jssip", async () => (await import("../fakes/fakeJssip")).fakeJssipModule);

const IDENTITY_PREFIXES = ["X-Organisation-Id", "X-Project-Id", "X-Endpoint-Id"];
const identityHeaders = (headers: string[]) =>
	headers.filter((h) => IDENTITY_PREFIXES.some((p) => h.startsWith(p)));

const play = vi.mocked(HTMLMediaElement.prototype.play);

beforeEach(() => {
	resetFakeJssip();
	play.mockClear();
});

afterEach(() => {
	window.destroyWebRTCWidget();
	play.mockReset();
	play.mockResolvedValue(undefined);
});

describe("SIP contract", () => {
	it("legacy endpoint: registers with realm credentials and dials app-<applicationSid>", async () => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		expect(lastUA().config).toMatchObject({
			uri: "sip:u-1@sip.example.com",
			password: "pw",
			authorization_user: "widget-user",
			register: true,
		});
		const [target, opts] = lastUA().call.mock.calls[0];
		expect(target).toBe("app-app-sid-1");
		expect(opts.mediaConstraints).toEqual({ audio: true, video: false });
		expect(identityHeaders(opts.extraHeaders)).toEqual([
			"X-Organisation-Id: org-1",
			"X-Project-Id: proj-1",
		]);
	});

	it("runtime endpoint: skips REGISTER, uses userId@wsUri-host, dials bare endpointId with all identity headers", async () => {
		serveConfig(runtimeConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		expect(lastUA().config.uri).toBe("sip:u-1@sbc.example.com");
		expect(lastUA().config.register).toBe(false);
		const [target, opts] = lastUA().call.mock.calls[0];
		expect(target).toBe("ep-1");
		expect(opts.mediaConstraints).toEqual({ audio: true, video: false });
		expect(identityHeaders(opts.extraHeaders)).toEqual([
			"X-Organisation-Id: org-1",
			"X-Project-Id: proj-1",
			"X-Endpoint-Id: ep-1",
		]);
	});

	it("places the INVITE only after the 1.2s ringing lead-in and plays the ringing tone", async () => {
		// The widget clears the element's src once the INVITE goes out, so record it at play time.
		const playedSrcs: string[] = [];
		play.mockImplementation(function (this: HTMLMediaElement) {
			playedSrcs.push(this.src);
			return Promise.resolve();
		});
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		const clickedAt = performance.now();
		await clickCall();

		// The UA may only come into existence after the click (async config/SDK setup).
		await waitFor(() => expect(lastUA().start).toHaveBeenCalled(), { timeout: 3000 });
		expect(lastUA().call).not.toHaveBeenCalled();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalledTimes(1), { timeout: 3000 });

		// Timers only fire late, never early: the INVITE goes out >= ~1.2s after the click.
		expect(lastUA().callTimestamps[0] - clickedAt).toBeGreaterThanOrEqual(1150);
		expect(playedSrcs).toContain(sounds.ringing);
	});

	it("reuses the stored userId from cognigy-webrtc-options", async () => {
		localStorage.setItem(
			"cognigy-webrtc-options",
			JSON.stringify({ userId: "webrtc-stored-1", other: 1 }),
		);
		serveConfig(legacyConfig());
		await mountWidget();
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		expect(lastUA().config.uri).toBe("sip:webrtc-stored-1@sip.example.com");
	});

	it("generates and persists a userId when none is stored, keeping other keys", async () => {
		localStorage.setItem("cognigy-webrtc-options", JSON.stringify({ other: 1 }));
		serveConfig(legacyConfig());
		await mountWidget();
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		const user = (lastUA().config.uri as string).replace(/^sip:/, "").split("@")[0];
		expect(user).toMatch(/^webrtc-voicegateway0f07-[A-Za-z0-9]{8}$/);
		const stored = JSON.parse(localStorage.getItem("cognigy-webrtc-options") ?? "{}");
		expect(stored).toEqual({ userId: user, other: 1 });
	});

	it("explicit options.userId wins over the stored one", async () => {
		localStorage.setItem(
			"cognigy-webrtc-options",
			JSON.stringify({ userId: "webrtc-stored-1" }),
		);
		serveConfig(legacyConfig());
		await mountWidget({ userId: "explicit-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		expect(lastUA().config.uri).toBe("sip:explicit-1@sip.example.com");
	});

	it("end call terminates with 480 'Ended by user' and stops the UA", async () => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		lastSession().progress();
		await clickEnd();

		await waitFor(() =>
			expect(lastSession().terminate).toHaveBeenCalledWith({
				status_code: 480,
				reason_phrase: "Ended by user",
			})
		);
		await waitFor(() => expect(lastUA().stop).toHaveBeenCalled());
	});

	it("mute toggles rtcSession.mute/unmute with audio+video", async () => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		const session: FakeRTCSession = lastSession();
		session.progress();
		session.accept();
		await screen.findByTestId("cognigy-mute-unmute-button");

		await clickMute();
		await waitFor(() =>
			expect(session.mute).toHaveBeenCalledWith({ audio: true, video: true })
		);
		await clickMute();
		await waitFor(() =>
			expect(session.unmute).toHaveBeenCalledWith({ audio: true, video: true })
		);
	});

	// No transfer UI; Replaces would auto-answer with the mic (CTCW-AC3-001/-002).
	it.each(["refer", "replaces"])("rejects an inbound %s request", async (kind) => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });

		const accept = vi.fn();
		const reject = vi.fn();
		lastSession().emit(kind, { request: {}, accept, reject });

		expect(reject).toHaveBeenCalledTimes(1);
		expect(accept).not.toHaveBeenCalled();
	});

	// SIP credentials travel over this socket (CTCW-SC8-001).
	it("refuses a cleartext ws:// URI and never creates a UA", async () => {
		serveConfig(
			legacyConfig({
				endpointSettings: {
					sipConnectivityInfo: {
						username: "widget-user",
						password: "pw",
						realm: "sip.example.com",
						applicationSid: "app-sid-1",
						wsUri: "ws://sip.example.com:8080",
					},
				},
			})
		);
		await mountWidget({ userId: "u-1" });
		await clickCall();
		// Past the 1.2s ringing lead-in, when the INVITE would have been placed.
		await new Promise((resolve) => setTimeout(resolve, 2500));

		expect(FakeUA.instances).toHaveLength(0);
	});
});
