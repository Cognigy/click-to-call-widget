import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/preact";
import { resetFakeJssip } from "./fakes/fakeJssip";
import { clickCall, legacyConfig, serveConfig } from "./contract/harness";
import type { IOptions } from "../types";
import "../main";

vi.mock("jssip", async () => (await import("./fakes/fakeJssip")).fakeJssipModule);

const mountWidget = (options?: IOptions) => window.initWebRTCWidget("/cfg-token", options);
const label = async () => within(await screen.findByTestId("cognigy-widget-label"));

beforeEach(() => {
	resetFakeJssip();
	localStorage.clear();
});

afterEach(() => {
	window.destroyWebRTCWidget();
});

describe("widget.updateSettings", () => {
	it("is exposed on the instance init resolves to", async () => {
		serveConfig(legacyConfig());
		const widget = await mountWidget({ userId: "u-1" });
		expect(typeof widget.updateSettings).toBe("function");
		expect(typeof widget.on).toBe("function");
	});

	it("changes the label and tagline without re-initializing", async () => {
		serveConfig(legacyConfig({ endpointSettings: { webrtcWidgetConfig: { label: "Before", active: true } } }));
		const widget = await mountWidget({ userId: "u-1" });
		await waitFor(async () => expect((await label()).getByText("Before")).toBeInTheDocument());

		widget.updateSettings({ webrtcWidgetConfig: { label: "After", tagline: "Hello" } });

		await waitFor(async () => expect((await label()).getByText("After")).toBeInTheDocument());
		expect((await label()).getByText("Hello")).toBeInTheDocument();
	});

	it("wins over an init-time widgetOverrides for the same field", async () => {
		serveConfig(legacyConfig());
		const widget = await window.initWebRTCWidget("/cfg-token", { userId: "u-1", widgetOverrides: { tagline: "Initial" } });
		await waitFor(async () => expect((await label()).getByText("Initial")).toBeInTheDocument());

		widget.updateSettings({ webrtcWidgetConfig: { tagline: "Updated" } });

		await waitFor(async () => expect((await label()).getByText("Updated")).toBeInTheDocument());
		expect((await label()).queryByText("Initial")).toBeNull();
	});

	it("is not lost when called before the endpoint config has loaded", async () => {
		serveConfig(legacyConfig({ endpointSettings: { webrtcWidgetConfig: { label: "Config", active: true } } }));
		const widget = await mountWidget({ userId: "u-1" });

		widget.updateSettings({ webrtcWidgetConfig: { label: "Early" } });

		await waitFor(async () => expect((await label()).getByText("Early")).toBeInTheDocument());
	});

	it("applies an updated privacy notice to the next call", async () => {
		serveConfig(
			legacyConfig({
				settings: {
					privacyNotice: {
						enabled: true,
						text: "Original notice",
						cancelButtonText: "Cancel",
						submitButtonText: "Accept",
						urlText: "",
						url: "",
					},
				},
			}),
		);
		const widget = await mountWidget({ userId: "u-1" });
		await screen.findByTestId("cognigy-call-button");

		widget.updateSettings({ settings: { privacyNotice: { text: "Updated notice" } } });
		await clickCall();

		expect(await screen.findByText("Updated notice")).toBeInTheDocument();
		expect(screen.getByText("Accept")).toBeInTheDocument();
	});
});
