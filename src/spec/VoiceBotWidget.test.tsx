import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/preact";
import type { ClientState, WebRTCClient } from "@cognigy/click-to-call-sdk";
import VoiceBotWidget from "../components/VoiceBotWidget";
import { WebrtcContext } from "../components/WebrtcContextProvider";
import type { IWebrtcContext } from "../types";
import * as sounds from "../constants/sounds";

const PRIVACY_KEY = "call-privacy-permission-granted";

const idleState: ClientState = {
	status: "idle",
	muted: false,
	session: null,
	endInfo: null,
	transcript: [],
	remoteStream: null,
	localStream: null,
};

function createFakeClient() {
	let state = idleState;
	const listeners = new Set<(s: ClientState) => void>();
	const emitState = (patch: Partial<ClientState>) => {
		state = { ...state, ...patch };
		act(() => {
			for (const l of listeners) l(state);
		});
	};
	const client = {
		getState: vi.fn(() => state),
		subscribe: vi.fn((listener: (s: ClientState) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}),
		connect: vi.fn(() => {
			emitState({ status: "connecting" });
			return Promise.resolve();
		}),
		isConnected: vi.fn(() => true),
		disconnect: vi.fn(() => Promise.resolve()),
		startCall: vi.fn(() => Promise.resolve()),
		endCall: vi.fn(() => Promise.resolve()),
		mute: vi.fn(() => Promise.resolve()),
		unmute: vi.fn(() => Promise.resolve()),
	};
	return { client, emitState };
}

// Built inline so the suite does not depend on the gitignored mock.json.
function baseContext(overrides: Partial<IWebrtcContext> = {}): IWebrtcContext {
	return {
		client: null,
		organisationId: "org-1",
		projectId: "proj-1",
		endpointSettings: {
			snapshotId: null,
			endpointUrlToken: "token",
			endpointName: "Endpoint",
			channel: "voiceGateway2",
			localeReferenceId: "locale-1",
			collectAnalytics: false,
			active: true,
			version: "test",
			sipConnectivityInfo: {
				username: "u",
				applicationSid: "sid",
				password: "pw",
				wsUri: "wss://sbc.example.com",
				realm: "sip.example.com",
			},
			webrtcWidgetConfig: {
				label: "Test Agent",
				tagline: "Talk to us",
				avatarLogoUrl: "https://example.com/avatar.png",
				active: true,
				transcription: { enabled: false },
			},
		},
		settings: {
			privacyNotice: {
				enabled: false,
				text: "We record calls.",
				cancelButtonText: "Cancel",
				submitButtonText: "Continue",
				urlText: "",
				url: "",
			},
			transcription: { enabled: false },
		},
		options: { userId: "u-1" },
		...overrides,
	};
}

function withPrivacyNotice(ctx: IWebrtcContext): IWebrtcContext {
	return {
		...ctx,
		settings: {
			...ctx.settings,
			privacyNotice: { ...ctx.settings.privacyNotice, enabled: true },
		},
	};
}

function withTranscription(ctx: IWebrtcContext, custom = false): IWebrtcContext {
	return {
		...ctx,
		endpointSettings: {
			...ctx.endpointSettings,
			webrtcWidgetConfig: {
				...ctx.endpointSettings.webrtcWidgetConfig,
				transcription: custom
					? { enabled: true, backgroundMode: "custom", backgroundColor: "rgb(2, 8, 23)" }
					: { enabled: true },
			},
		},
	};
}

describe("VoiceBotWidget", () => {
	let fake: ReturnType<typeof createFakeClient>;

	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		fake = createFakeClient();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const renderWidget = (ctx: IWebrtcContext = baseContext()) =>
		render(
			<WebrtcContext.Provider
				value={{ ...ctx, client: fake.client as unknown as WebRTCClient }}
			>
				<VoiceBotWidget />
			</WebrtcContext.Provider>
		);

	const tagline = (widget: ReturnType<typeof renderWidget>) =>
		widget.getByTestId("cognigy-widget-label").querySelector(".webrtc_widget_tagline");

	it("renders correctly in initial state", () => {
		const widget = renderWidget();
		expect(widget.getByText("Test Agent")).toBeInTheDocument();
		expect(widget.getByText("Talk to us")).toBeInTheDocument();
		expect(widget.getByTestId("cognigy-call-button")).toBeInTheDocument();
		expect(widget.getByRole("img", { name: "AI Agent Avatar" })).toBeInTheDocument();
		expect(widget.getByText("Powered by")).toBeInTheDocument();
	});

	it("starts the call directly when no privacy notice is required", async () => {
		const widget = renderWidget();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(fake.client.connect).toHaveBeenCalledTimes(1);
		expect(widget.queryByTestId("cognigy-privacy-dialog")).not.toBeInTheDocument();
		// The INVITE follows the 1.2 s ringing lead-in.
		expect(fake.client.startCall).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1200);
		expect(fake.client.startCall).toHaveBeenCalledTimes(1);
	});

	it("shows the privacy dialog when consent is missing", () => {
		const widget = renderWidget(withPrivacyNotice(baseContext()));
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(widget.getByTestId("cognigy-privacy-dialog")).toBeInTheDocument();
		expect(fake.client.connect).not.toHaveBeenCalled();
	});

	it("starts the call after the privacy dialog is accepted", () => {
		const widget = renderWidget(withPrivacyNotice(baseContext()));
		fireEvent.click(widget.getByTestId("cognigy-call-button"));
		fireEvent.click(widget.getByTestId("cognigy-privacy-continue"));

		expect(localStorage.getItem(PRIVACY_KEY)).toBe("true");
		expect(fake.client.connect).toHaveBeenCalledTimes(1);
		expect(widget.queryByTestId("cognigy-privacy-dialog")).not.toBeInTheDocument();
	});

	it("skips the privacy dialog when consent was stored", () => {
		localStorage.setItem(PRIVACY_KEY, "true");
		const widget = renderWidget(withPrivacyNotice(baseContext()));
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(widget.queryByTestId("cognigy-privacy-dialog")).not.toBeInTheDocument();
		expect(fake.client.connect).toHaveBeenCalledTimes(1);
	});

	it("returns to idle without calling when the privacy dialog is rejected", () => {
		const widget = renderWidget(withPrivacyNotice(baseContext()));
		fireEvent.click(widget.getByTestId("cognigy-call-button"));
		fireEvent.click(widget.getByTestId("cognigy-privacy-cancel"));

		expect(widget.queryByTestId("cognigy-privacy-dialog")).not.toBeInTheDocument();
		expect(widget.getByTestId("cognigy-call-button")).toBeInTheDocument();
		expect(fake.client.connect).not.toHaveBeenCalled();
		expect(localStorage.getItem(PRIVACY_KEY)).toBeNull();
	});

	it("shows Calling... and the connecting banner when transcription is enabled", () => {
		const widget = renderWidget(withTranscription(baseContext(), true));
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(tagline(widget)).toHaveTextContent("Calling...");
		expect(
			widget.getByTestId("cognigy-widget-label").querySelector(".webrtc_widget_call_duration")
		).toBeNull();
		expect(widget.getByText(/Connecting to/)).toBeInTheDocument();
	});

	it("shows Connecting... when transcription is disabled", () => {
		const widget = renderWidget();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(tagline(widget)).toHaveTextContent("Connecting...");
		expect(widget.queryByText(/Connecting to/)).toBeNull();
	});

	it("renders a hidden placeholder when the widget is inactive", () => {
		const ctx = baseContext();
		const { container } = renderWidget({
			...ctx,
			endpointSettings: {
				...ctx.endpointSettings,
				webrtcWidgetConfig: { ...ctx.endpointSettings.webrtcWidgetConfig, active: false },
			},
		});
		const hidden = container.querySelector(".webrtc_widget_container");
		expect(hidden).toBeInTheDocument();
		expect(hidden).toHaveStyle({ visibility: "hidden" });
		expect(container.querySelector("[data-testid='cognigy-call-button']")).toBeNull();
	});

	it("displays call controls while a call is in progress", () => {
		const widget = renderWidget();
		fake.emitState({ status: "ringing" });

		expect(widget.getByTestId("cognigy-end-call-button")).toBeInTheDocument();
		expect(widget.getByTestId("cognigy-mute-unmute-button")).toBeInTheDocument();
		expect(widget.queryByTestId("cognigy-call-button")).not.toBeInTheDocument();
	});

	it("disables end call until the call rings", () => {
		const widget = renderWidget();
		fake.emitState({ status: "connecting" });
		expect(widget.getByTestId("cognigy-end-call-button")).toBeDisabled();

		fake.emitState({ status: "ringing" });
		expect(widget.getByTestId("cognigy-end-call-button")).toBeEnabled();
	});

	it("mute button is disabled until the call is answered", () => {
		const widget = renderWidget();
		fake.emitState({ status: "ringing" });
		expect(widget.getByTestId("cognigy-mute-unmute-button")).toBeDisabled();

		fake.emitState({ status: "answered" });
		expect(widget.getByTestId("cognigy-mute-unmute-button")).toBeEnabled();
	});

	it("toggles mute through the client based on the muted state", () => {
		const widget = renderWidget();
		fake.emitState({ status: "answered" });

		fireEvent.click(widget.getByTestId("cognigy-mute-unmute-button"));
		expect(fake.client.mute).toHaveBeenCalledTimes(1);

		fake.emitState({ muted: true });
		expect(widget.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
		fireEvent.click(widget.getByTestId("cognigy-mute-unmute-button"));
		expect(fake.client.unmute).toHaveBeenCalledTimes(1);
	});

	it("ends the call through the client and returns to idle on ended", () => {
		const widget = renderWidget();
		fake.emitState({ status: "ringing" });

		fireEvent.click(widget.getByTestId("cognigy-end-call-button"));
		expect(fake.client.endCall).toHaveBeenCalledTimes(1);

		fake.emitState({ status: "ended" });
		expect(widget.getByTestId("cognigy-call-button")).toBeInTheDocument();
	});

	it("does not place the INVITE when the call is ended during the lead-in", async () => {
		const widget = renderWidget();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));
		fake.emitState({ status: "ringing" });
		fireEvent.click(widget.getByTestId("cognigy-end-call-button"));

		await vi.advanceTimersByTimeAsync(1500);
		expect(fake.client.startCall).not.toHaveBeenCalled();
	});

	it("reconnects before the INVITE when the transport dropped during the lead-in", async () => {
		const play = vi.mocked(HTMLMediaElement.prototype.play);
		const played: string[] = [];
		play.mockImplementation(function (this: HTMLMediaElement) {
			played.push(this.src);
			return Promise.resolve();
		});
		// Like the SDK: tearing down the pending connection reports "ended".
		fake.client.disconnect.mockImplementationOnce(() => {
			fake.emitState({ status: "ended", endInfo: { originator: "local", cause: "Canceled" } });
			return Promise.resolve();
		});
		const widget = renderWidget();
		fake.client.isConnected.mockReturnValueOnce(false);
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		await vi.advanceTimersByTimeAsync(1200);
		expect(fake.client.disconnect).toHaveBeenCalledTimes(1);
		expect(fake.client.connect).toHaveBeenCalledTimes(2);
		expect(fake.client.startCall).toHaveBeenCalledTimes(1);
		// The teardown is internal: no hangup tone, no flash back to idle.
		expect(played).not.toContain(sounds.hungup);
		expect(widget.queryByTestId("cognigy-call-button")).not.toBeInTheDocument();
		play.mockReset();
		play.mockResolvedValue(undefined);
	});

	it("logs instead of throwing when connect rejects", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		fake.client.connect.mockImplementationOnce(() => {
			fake.emitState({ status: "failed" });
			return Promise.reject(new Error("Call setup timeout"));
		});
		const widget = renderWidget();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		await vi.advanceTimersByTimeAsync(1200);
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(fake.client.startCall).not.toHaveBeenCalled();
		expect(widget.getByTestId("cognigy-call-button")).toBeInTheDocument();
		error.mockRestore();
	});

	it("renders transcript messages from the client state", () => {
		const widget = renderWidget(withTranscription(baseContext()));
		fake.emitState({
			status: "answered",
			transcript: [
				{ id: "m1", text: "Hello there", originator: "bot", timestamp: Date.now() },
				{ id: "m2", text: "Hi bot", originator: "user", timestamp: Date.now() },
			],
		});

		expect(widget.getByText("Hello there")).toBeInTheDocument();
		expect(widget.getByText("Hi bot")).toBeInTheDocument();
	});
});
