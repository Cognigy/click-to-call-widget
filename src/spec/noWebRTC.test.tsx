import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/preact";
import { FakeUA, resetFakeJssip } from "./fakes/fakeJssip";
import { legacyConfig, mountWidget, serveConfig } from "./contract/harness";
import "../main";

vi.mock("jssip", async () => (await import("./fakes/fakeJssip")).fakeJssipModule);

// Insecure http:// pages and old webviews: no RTCPeerConnection, no mediaDevices.
describe("without WebRTC support", () => {
	let rtcPeerConnection: typeof window.RTCPeerConnection;
	let mediaDevices: PropertyDescriptor | undefined;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		resetFakeJssip();
		rtcPeerConnection = window.RTCPeerConnection;
		mediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
		(window as { RTCPeerConnection?: unknown }).RTCPeerConnection = undefined;
		Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		window.destroyWebRTCWidget();
		window.RTCPeerConnection = rtcPeerConnection;
		if (mediaDevices) Object.defineProperty(navigator, "mediaDevices", mediaDevices);
		errorSpy.mockRestore();
	});

	it("init resolves with an inert on(), the widget renders from the config and a call click is harmless", async () => {
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		try {
			serveConfig(legacyConfig());
			const widget = await mountWidget({ userId: "u-1" });

			const handler = vi.fn();
			expect(() => widget.on("connected", handler)).not.toThrow();

			const button = await screen.findByTestId("cognigy-call-button");
			expect(() => fireEvent.click(button)).not.toThrow();
			await new Promise((r) => setTimeout(r, 1500));

			expect(FakeUA.instances).toHaveLength(0);
			expect(handler).not.toHaveBeenCalled();
			expect(unhandled).not.toHaveBeenCalled();
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("WebRTC"),
				expect.anything()
			);
		} finally {
			process.off("unhandledRejection", unhandled);
		}
	});
});
