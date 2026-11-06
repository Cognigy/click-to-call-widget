import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/preact";
import { FakeUA, resetFakeJssip } from "../fakes/fakeJssip";
import {
	clickCall,
	clickEnd,
	lastSession,
	lastUA,
	legacyConfig,
	mountWidget,
	serveConfig,
} from "./harness";
import "../../main";

vi.mock("jssip", async () => (await import("../fakes/fakeJssip")).fakeJssipModule);

const PRIVACY_KEY = "call-privacy-permission-granted";
const TIMEOUT = { timeout: 3000 };

const expectIdle = () =>
	waitFor(
		() => expect(screen.getByTestId("cognigy-call-button")).toBeInTheDocument(),
		{ timeout: 2000 }
	);

beforeEach(() => {
	resetFakeJssip();
});

afterEach(() => {
	vi.useRealTimers();
	window.destroyWebRTCWidget();
});

describe("event contract", () => {
	it("ending the call before it is answered returns the UI to idle", async () => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);
		lastSession().progress();

		await clickEnd();

		await waitFor(() =>
			expect(lastSession().terminate).toHaveBeenCalledWith({
				status_code: 480,
				reason_phrase: "Ended by user",
			})
		);
		await expectIdle();
	});

	it("widget.on subscribes to SDK session events", async () => {
		serveConfig(legacyConfig());
		const widget = await mountWidget({ userId: "u-1" });
		const events: string[] = [];
		for (const name of ["sessionCreated", "ringing", "answered", "ended"]) {
			widget.on(name, () => events.push(name));
		}
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);

		lastSession().progress();
		await waitFor(() => expect(events).toEqual(["sessionCreated", "ringing"]));
		lastSession().accept();
		await waitFor(() => expect(events).toEqual(["sessionCreated", "ringing", "answered"]));

		await clickEnd();
		await waitFor(() =>
			expect(events).toEqual(["sessionCreated", "ringing", "answered", "ended"])
		);
	});

	it("widget.on delivers transcription and incoming INFO as SDK events", async () => {
		serveConfig(legacyConfig());
		const widget = await mountWidget({ userId: "u-1" });
		const infos: unknown[] = [];
		const transcriptions: unknown[] = [];
		widget.on("infoReceived", (data: unknown) => infos.push(data));
		widget.on("transcription", (data: unknown) => transcriptions.push(data));
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);

		lastSession().receiveInfo('{"hello":1}');
		await waitFor(() => expect(infos).toHaveLength(1));
		expect(infos[0]).toEqual(
			expect.objectContaining({
				originator: "remote",
				info: expect.objectContaining({ body: '{"hello":1}' }),
			})
		);
		expect(transcriptions).toHaveLength(0);

		lastSession().receiveInfo(
			'{"_transcription":{"originator":"bot","messages":[{"text":"Hi"}]}}'
		);
		await waitFor(() => expect(transcriptions).toHaveLength(1));
		expect(transcriptions[0]).toEqual({
			originator: "bot",
			messages: [{ text: "Hi" }],
		});
	});

	it("widget.on('newRTCSession') warns that it is removed and never fires", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		serveConfig(legacyConfig());
		const widget = await mountWidget({ userId: "u-1" });
		const handler = vi.fn();
		widget.on("newRTCSession", handler);
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);

		expect(warn).toHaveBeenCalledWith(expect.stringContaining("newRTCSession"));
		expect(handler).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("connecting/connected/disconnected are forwarded to widget.on", async () => {
		serveConfig(legacyConfig());
		const widget = await mountWidget({ userId: "u-1" });
		const connecting = vi.fn();
		const connected = vi.fn();
		const disconnected = vi.fn();
		widget.on("connecting", connecting);
		widget.on("connected", connected);
		widget.on("disconnected", disconnected);
		await clickCall();

		await waitFor(() => {
			expect(connecting).toHaveBeenCalled();
			expect(connected).toHaveBeenCalled();
		}, TIMEOUT);
		expect(disconnected).not.toHaveBeenCalled();

		lastUA().emit("disconnected", {});
		await waitFor(() => expect(disconnected).toHaveBeenCalled());
	});
});

describe("timeout and disconnect contract", () => {
	it("setup timeout: no session within 10s stops the UA and returns to idle", async () => {
		FakeUA.autoSession = false;
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await screen.findByTestId("cognigy-call-button");

		vi.useFakeTimers({ shouldAdvanceTime: true });
		await clickCall();
		await waitFor(() => expect(lastUA().start).toHaveBeenCalled(), TIMEOUT);

		await vi.advanceTimersByTimeAsync(1_500);
		expect(lastUA().call).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(7_500);
		expect(lastUA().stop).not.toHaveBeenCalled();
		expect(screen.queryByTestId("cognigy-call-button")).not.toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(1_500);
		vi.useRealTimers();

		await waitFor(() => expect(lastUA().stop).toHaveBeenCalled());
		await expectIdle();
	});

	it("disconnect before the session exists is ignored", async () => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().start).toHaveBeenCalled(), TIMEOUT);

		expect(lastUA().call).not.toHaveBeenCalled();
		lastUA().emit("disconnected", {});
		await new Promise((r) => setTimeout(r, 100));

		expect(
			document.querySelector(".webrtc_widget_tagline")
		).toHaveTextContent("Connecting...");
		expect(screen.queryByTestId("cognigy-call-button")).not.toBeInTheDocument();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);
	});

	it("disconnect after the session exists ends the call", async () => {
		serveConfig(legacyConfig());
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);
		lastSession().progress();

		lastUA().emit("disconnected", {});

		await expectIdle();
		await waitFor(() => expect(lastUA().stop).toHaveBeenCalled());
	});
});

describe("consent and transcription contract", () => {
	it("privacy notice: shows dialog first, places call only after consent and stores it", async () => {
		serveConfig(
			legacyConfig({
				settings: {
					privacyNotice: {
						enabled: true,
						text: "We record calls.",
						submitButtonText: "Continue",
					},
				},
			})
		);
		await mountWidget({ userId: "u-1" });
		await clickCall();

		await screen.findByTestId("cognigy-privacy-dialog");
		await new Promise((r) => setTimeout(r, 300));
		expect(FakeUA.instances.flatMap((ua) => ua.start.mock.calls)).toHaveLength(0);
		expect(localStorage.getItem(PRIVACY_KEY)).toBeNull();

		screen.getByTestId("cognigy-privacy-continue").click();

		await waitFor(() => expect(localStorage.getItem(PRIVACY_KEY)).toBe("true"));
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);
		expect(screen.queryByTestId("cognigy-privacy-dialog")).not.toBeInTheDocument();
	});

	it("transcription messages render in the transcript when enabled", async () => {
		serveConfig(
			legacyConfig({
				endpointSettings: {
					webrtcWidgetConfig: {
						label: "",
						active: true,
						transcription: { enabled: true },
					},
				},
			})
		);
		await mountWidget({ userId: "u-1" });
		await clickCall();
		await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), TIMEOUT);

		lastSession().progress();
		lastSession().accept();
		lastSession().receiveInfo(
			'{"_transcription":{"originator":"bot","messages":[{"text":"Hi"}]}}'
		);

		expect(await screen.findByText("Hi")).toBeInTheDocument();
	});
});
