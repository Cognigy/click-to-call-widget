import { fireEvent, screen, waitFor } from "@testing-library/preact";
import { expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { IOptions } from "../../types";
import { type FakeRTCSession, FakeUA } from "../fakes/fakeJssip";
import { server } from "../setup";

export interface LegacyWidget {
	on: (event: string, handler: (...args: any[]) => void) => void;
}

const WS_URI = "wss://sbc.example.com:8443";

// Built inline so the contract does not depend on a fixture.
function baseConfig(
	sipConnectivityInfo: Record<string, unknown>,
	endpointId?: string
) {
	return {
		organisationId: "org-1",
		projectId: "proj-1",
		endpointSettings: {
			snapshotId: null,
			endpointUrlToken: "token",
			endpointName: "Voice Gateway #0f07",
			channel: "voiceGateway2",
			localeReferenceId: "locale-1",
			collectAnalytics: false,
			active: true,
			version: "test",
			...(endpointId ? { endpointId } : {}),
			webrtcWidgetConfig: { label: "", active: true },
			sipConnectivityInfo,
		},
		settings: { privacyNotice: { enabled: false } },
	};
}

type ConfigOverrides = Record<string, any>;

function withOverrides(
	config: ReturnType<typeof baseConfig>,
	overrides: ConfigOverrides = {}
) {
	const { endpointSettings, settings, ...rest } = overrides;
	return {
		...config,
		...rest,
		endpointSettings: { ...config.endpointSettings, ...endpointSettings },
		settings: { ...config.settings, ...settings },
	};
}

export function legacyConfig(overrides?: ConfigOverrides) {
	return withOverrides(
		baseConfig({
			username: "widget-user",
			password: "pw",
			realm: "sip.example.com",
			applicationSid: "app-sid-1",
			wsUri: WS_URI,
		}),
		overrides
	);
}

export function legacyConfigWithEndpointId(overrides?: ConfigOverrides) {
	return withOverrides(
		baseConfig(
			{
				username: "widget-user",
				password: "pw",
				realm: "sip.example.com",
				applicationSid: "app-sid-1",
				wsUri: WS_URI,
			},
			"ep-1"
		),
		overrides
	);
}

export function runtimeConfig(overrides?: ConfigOverrides) {
	return withOverrides(baseConfig({ wsUri: WS_URI }, "ep-1"), overrides);
}

export function serveConfig(config: unknown): void {
	server.use(
		http.get("*/cfg-token", () =>
			HttpResponse.json(config as Record<string, unknown>)
		)
	);
}

export async function mountWidget(options?: IOptions): Promise<LegacyWidget> {
	const widget = (await window.initWebRTCWidget("/cfg-token", options)) as LegacyWidget;
	// Lets effects build the SIP client before the first click.
	await new Promise((resolve) => setTimeout(resolve, 150));
	return widget;
}

export async function clickCall() {
	fireEvent.click(await screen.findByTestId("cognigy-call-button"));
}

export async function clickEnd() {
	// A click on the disabled button is a silent no-op, so wait until it is enabled.
	let button!: HTMLElement;
	await waitFor(() => {
		button = screen.getByTestId("cognigy-end-call-button");
		expect(button).toBeEnabled();
	});
	fireEvent.click(button);
}

export async function clickMute() {
	fireEvent.click(await screen.findByTestId("cognigy-mute-unmute-button"));
}

export function lastUA(): FakeUA {
	const ua = FakeUA.instances[FakeUA.instances.length - 1];
	if (!ua) throw new Error("no FakeUA was created");
	return ua;
}

export function lastSession(): FakeRTCSession {
	const session = lastUA().sessions[lastUA().sessions.length - 1];
	if (!session) throw new Error("no FakeRTCSession was created");
	return session;
}
