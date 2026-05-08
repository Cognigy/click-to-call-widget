import { describe, it, expect } from "vitest";
import { webrtcReducer, initialState } from "../components/WebrtcContextProvider";
import { ActionTypes } from "../types";

const baseState = {
	...initialState,
	options: {
		userId: "existing-user",
		demoMode: false,
		ui: {
			labels: {
				callButton: "Call",
				endButton: "End",
				listenLabel: "Listening",
			},
		},
		widgetOverrides: {
			theme: "light" as const,
			tagline: "Original tagline",
		},
	},
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
		endpointName: "My Endpoint",
		channel: "webchat",
		localeReferenceId: "en-US",
		collectAnalytics: true,
		active: true,
		version: "1.0",
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
			theme: "light" as const,
			avatarLogoUrl: "https://old-avatar.com/img.png",
			transcription: { enabled: false, backgroundMode: "transparent", backgroundColor: "" },
		},
	},
};

describe("webrtcReducer — UPDATE_SETTINGS", () => {
	it("merges ui.labels without replacing unspecified labels", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { ui: { labels: { callButton: "Ring" } } },
		});
		expect(result.options.ui.labels.callButton).toBe("Ring");
		expect(result.options.ui.labels.endButton).toBe("End");
		expect(result.options.ui.labels.listenLabel).toBe("Listening");
	});

	it("merges widgetOverrides without replacing unspecified fields", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { widgetOverrides: { tagline: "New tagline" } },
		});
		expect(result.options.widgetOverrides.tagline).toBe("New tagline");
		expect(result.options.widgetOverrides.theme).toBe("light");
	});

	it("merges settings.privacyNotice without replacing unspecified fields", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { settings: { privacyNotice: { enabled: false } } },
		});
		expect(result.settings.privacyNotice.enabled).toBe(false);
		expect(result.settings.privacyNotice.text).toBe("Privacy text");
	});

	it("merges webrtcWidgetConfig fields", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { webrtcWidgetConfig: { tagline: "Updated tagline", avatarLogoUrl: "https://new.com/img.png" } },
		});
		expect(result.endpointSettings.webrtcWidgetConfig.tagline).toBe("Updated tagline");
		expect(result.endpointSettings.webrtcWidgetConfig.avatarLogoUrl).toBe("https://new.com/img.png");
		expect(result.endpointSettings.webrtcWidgetConfig.label).toBe("Widget");
	});

	it("does NOT update webrtcWidgetConfig.active (protected field excluded by type)", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { webrtcWidgetConfig: { tagline: "X" } },
		});
		expect(result.endpointSettings.webrtcWidgetConfig.active).toBe(true);
	});

	it("does NOT touch sipConnectivityInfo", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { webrtcWidgetConfig: { tagline: "X" } },
		});
		expect(result.endpointSettings.sipConnectivityInfo.password).toBe("secret");
		expect(result.endpointSettings.sipConnectivityInfo.wsUri).toBe("wss://sip.example.com");
	});

	it("does NOT touch protected IEndpointSettings fields", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { webrtcWidgetConfig: { tagline: "X" } },
		});
		expect(result.endpointSettings.snapshotId).toBe("snap-1");
		expect(result.endpointSettings.endpointUrlToken).toBe("token-abc");
		expect(result.endpointSettings.channel).toBe("webchat");
		expect(result.endpointSettings.active).toBe(true);
	});

	it("does NOT touch options.userId or options.demoMode", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { ui: { labels: { callButton: "Ring" } } },
		});
		expect(result.options.userId).toBe("existing-user");
		expect(result.options.demoMode).toBe(false);
	});

	it("leaves slices untouched when not included in payload", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.UPDATE_SETTINGS,
			payload: { ui: { labels: { callButton: "Ring" } } },
		});
		expect(result.settings).toEqual(baseState.settings);
		expect(result.endpointSettings.webrtcWidgetConfig).toEqual(baseState.endpointSettings.webrtcWidgetConfig);
	});

	it("existing SET_OPTIONS behaviour is unaffected", () => {
		const result = webrtcReducer(baseState, {
			type: ActionTypes.SET_OPTIONS,
			payload: { widgetOverrides: { tagline: "Via SET_OPTIONS" } },
		});
		expect(result.options.widgetOverrides.tagline).toBe("Via SET_OPTIONS");
		expect(result.options.widgetOverrides.theme).toBe("light");
	});
});
