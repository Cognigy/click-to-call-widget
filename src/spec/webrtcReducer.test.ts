import { describe, it, expect } from "vitest";
import { webrtcReducer, initialState } from "../components/WebrtcContextProvider";
import { ActionTypes } from "../types";

const baseState = {
	...initialState,
	settings: {
		privacyNotice: {
			enabled: true,
			text: "Privacy text",
			cancelButtonText: "Cancel",
			submitButtonText: "Submit",
			urlText: "Link",
			url: "https://example.com",
		},
		transcription: { enabled: false },
	},
	endpointSettings: {
		...initialState.endpointSettings,
		snapshotId: "snap-1",
		endpointUrlToken: "token-abc",
		channel: "webchat",
		active: true,
		sipConnectivityInfo: {
			username: "sip-user",
			applicationSid: "app-sid",
			password: "secret",
			wsUri: "wss://sip.example.com",
			realm: "example.com",
		},
		webrtcWidgetConfig: {
			label: "Widget",
			active: true,
			tagline: "Original",
			avatarLogoUrl: "https://old-avatar.com/img.png",
			transcription: { enabled: false, backgroundMode: "transparent", backgroundColor: "" },
		},
	},
};

const update = (state: any, payload: unknown) =>
	webrtcReducer(state, { type: ActionTypes.UPDATE_SETTINGS, payload });

describe("webrtcReducer — UPDATE_SETTINGS", () => {
	it("deep-merges settings.privacyNotice", () => {
		const result = update(baseState, { settings: { privacyNotice: { enabled: false } } });
		expect(result.settings.privacyNotice.enabled).toBe(false);
		expect(result.settings.privacyNotice.text).toBe("Privacy text");
		expect(result.settings.transcription).toEqual({ enabled: false });
	});

	it("shallow-merges webrtcWidgetConfig", () => {
		const result = update(baseState, {
			webrtcWidgetConfig: { tagline: "Updated", avatarLogoUrl: "https://new.com/img.png" },
		});
		const config = result.endpointSettings.webrtcWidgetConfig;
		expect(config.tagline).toBe("Updated");
		expect(config.avatarLogoUrl).toBe("https://new.com/img.png");
		expect(config.label).toBe("Widget");
	});

	it("ignores webrtcWidgetConfig.active even from untyped callers", () => {
		const result = update(baseState, { webrtcWidgetConfig: { active: false, tagline: "X" } });
		expect(result.endpointSettings.webrtcWidgetConfig.active).toBe(true);
		expect(result.endpointSettings.webrtcWidgetConfig.tagline).toBe("X");
	});

	it("never touches sipConnectivityInfo or other protected endpoint fields", () => {
		const { endpointSettings } = update(baseState, { webrtcWidgetConfig: { tagline: "X" } });
		expect(endpointSettings.sipConnectivityInfo).toEqual(baseState.endpointSettings.sipConnectivityInfo);
		expect(endpointSettings.snapshotId).toBe("snap-1");
		expect(endpointSettings.channel).toBe("webchat");
		expect(endpointSettings.active).toBe(true);
	});

	it("ignores other top-level keys such as userId and demoMode", () => {
		const result = update(baseState, { webrtcWidgetConfig: { tagline: "X" }, userId: "evil", demoMode: true });
		expect(result.settings).toEqual(baseState.settings);
		expect(result.options).toEqual(baseState.options);
	});

	it("accepts an empty or missing payload", () => {
		expect(update(baseState, {}).settings).toEqual(baseState.settings);
		expect(update(baseState, undefined).settings).toEqual(baseState.settings);
	});

	it("accumulates successive updates", () => {
		let state = update(baseState, { settings: { privacyNotice: { text: "One" } } });
		state = update(state, { settings: { privacyNotice: { url: "https://two.example" } } });
		expect(state.settings.privacyNotice.text).toBe("One");
		expect(state.settings.privacyNotice.url).toBe("https://two.example");
	});

	it("survives a SET_DATA config load that arrives after it", () => {
		const early = update(initialState, {
			webrtcWidgetConfig: { label: "Early" },
			settings: { privacyNotice: { text: "Early text" } },
		});
		const loaded = webrtcReducer(early, {
			type: ActionTypes.SET_DATA,
			payload: { endpointSettings: baseState.endpointSettings, settings: baseState.settings, options: { userId: "u" } },
		});
		expect(loaded.endpointSettings.webrtcWidgetConfig.label).toBe("Early");
		expect(loaded.endpointSettings.webrtcWidgetConfig.tagline).toBe("Original");
		expect(loaded.settings.privacyNotice.text).toBe("Early text");
		expect(loaded.settings.privacyNotice.url).toBe("https://example.com");
		expect(loaded.options.userId).toBe("u");
	});
});
