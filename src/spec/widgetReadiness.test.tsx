import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/preact";
import { http, HttpResponse, delay } from "msw";

import { server } from "./setup";
import { WidgetRoot } from "../components/WidgetRoot";
import mockData from "../mocks/mock.example.json";
import type { IWidgetInstance } from "../types/index.ts";

/**
 * Readiness contract of the real widget tree (CGY-36067 follow-up).
 *
 * Unlike initLifecycle.test.tsx, the tree is real except for the SIP client and
 * the MUI icons (which resolve real React under vitest), so this exercises the actual timing between the imperative handle,
 * the endpoint config fetch and SIP client creation -- the gap the mocked
 * tests could not see: the instance was handed out before the config had
 * loaded, so `on()` and `updateSettings()` called right after init were
 * silently lost.
 *
 * (`WidgetRoot` is `App` without Emotion's `CacheProvider`, which cannot render
 * under vitest -- see hostPageHygiene.test.tsx.)
 */

const { sipClients, FakeSipClient } = vi.hoisted(() => {
	// biome-ignore lint/style/noCommonJs: vi.hoisted runs before ESM imports are bound
	const { EventEmitter } = require("events");
	const sipClients: any[] = [];
	class FakeSipClient extends EventEmitter {
		start = vi.fn();
		stop = vi.fn();
		call = vi.fn();
		constructor() {
			super();
			sipClients.push(this);
		}
	}
	return { sipClients, FakeSipClient };
});

vi.mock("../utils/SipClient", () => ({
	SipClient: vi.fn(() => new FakeSipClient()),
}));

vi.mock("@mui/icons-material/Phone", () => ({ default: () => <span /> }));
vi.mock("@mui/icons-material/Mic", () => ({ default: () => <span /> }));
vi.mock("@mui/icons-material/MicOff", () => ({ default: () => <span /> }));
vi.mock("@mui/icons-material/PhoneDisabled", () => ({ default: () => <span /> }));

const TOKEN_URL = "http://localhost:3000/example-token";

const renderRoot = () => {
	const mainRef = vi.fn<(instance: IWidgetInstance | null) => void>();
	const onError = vi.fn<(error: Error) => void>();
	render(<WidgetRoot token={TOKEN_URL} options={{}} mainRef={mainRef} onError={onError} />);
	return { mainRef, onError };
};

const readyInstance = async (mainRef: ReturnType<typeof vi.fn>) => {
	await waitFor(() => expect(mainRef).toHaveBeenCalledWith(expect.anything()));
	return mainRef.mock.calls.find(([instance]) => instance)?.[0] as IWidgetInstance;
};

describe("WidgetRoot readiness (CGY-36067)", () => {
	beforeEach(() => {
		sipClients.length = 0;
		localStorage.clear();
	});

	it("does not report the widget ready until the endpoint config has loaded", async () => {
		server.use(
			http.get("*/example-token", async () => {
				await delay(50);
				return HttpResponse.json(mockData);
			})
		);
		const { mainRef } = renderRoot();

		// The imperative handle exists after the first render, the config does not.
		await new Promise((r) => setTimeout(r, 10));
		expect(mainRef).not.toHaveBeenCalled();

		await readyInstance(mainRef);
		expect(screen.getByText(mockData.endpointSettings.webrtcWidgetConfig.label)).toBeInTheDocument();
	});

	it("keeps an updateSettings() made straight after ready (not overwritten by the config)", async () => {
		const { mainRef } = renderRoot();
		const widget = await readyInstance(mainRef);

		widget.updateSettings({ webrtcWidgetConfig: { label: "Updated right after init" } });

		expect(await screen.findByText("Updated right after init")).toBeInTheDocument();
	});

	it("delivers events to an on() listener registered straight after ready", async () => {
		const { mainRef } = renderRoot();
		const widget = await readyInstance(mainRef);

		const handler = vi.fn();
		widget.on("connecting", handler);

		await waitFor(() => expect(sipClients).toHaveLength(1));
		sipClients[0].emit("connecting", { client: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("re-attaches on() listeners when the SIP client is recreated", async () => {
		const mainRef = vi.fn<(instance: IWidgetInstance | null) => void>();
		const { rerender } = render(
			<WidgetRoot token={TOKEN_URL} options={{}} mainRef={mainRef} />
		);
		const widget = await readyInstance(mainRef);
		const handler = vi.fn();
		widget.on("connecting", handler);
		await waitFor(() => expect(sipClients).toHaveLength(1));

		// A different userId changes the SIP identity, so a new client is built.
		rerender(<WidgetRoot token={TOKEN_URL} options={{ userId: "someone-else" }} mainRef={mainRef} />);
		await waitFor(() => expect(sipClients).toHaveLength(2));
		expect(sipClients[0].stop).toHaveBeenCalled();

		sipClients[1].emit("connecting", { client: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does not recreate (and stop) the SIP client on a cosmetic updateSettings()", async () => {
		const { mainRef } = renderRoot();
		const widget = await readyInstance(mainRef);
		await waitFor(() => expect(sipClients).toHaveLength(1));

		widget.updateSettings({ webrtcWidgetConfig: { label: "New label" } });
		await screen.findByText("New label");
		// The SIP effect runs after paint, i.e. after the DOM already shows the label.
		await new Promise((r) => setTimeout(r, 50));

		// Stopping the client would terminate an active call.
		expect(sipClients).toHaveLength(1);
		expect(sipClients[0].stop).not.toHaveBeenCalled();
	});

	it("reports an error instead of becoming ready when the config fetch fails", async () => {
		server.use(http.get("*/example-token", () => new HttpResponse(null, { status: 404 })));
		const { mainRef, onError } = renderRoot();

		await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
		expect(onError.mock.calls[0][0].message).toMatch(/HTTP 404/);
		expect(mainRef).not.toHaveBeenCalledWith(expect.anything());
	});

	it("still becomes ready for an endpoint whose widget config is inactive", async () => {
		const inactive = structuredClone(mockData);
		inactive.endpointSettings.webrtcWidgetConfig.active = false;
		server.use(http.get("*/example-token", () => HttpResponse.json(inactive)));
		const { mainRef, onError } = renderRoot();

		// A loaded-but-inactive endpoint is a valid state, not a failure: init
		// must settle as ready (it used to hang forever), with the widget hidden.
		await readyInstance(mainRef);
		expect(onError).not.toHaveBeenCalled();
		expect(
			screen.queryByText(mockData.endpointSettings.webrtcWidgetConfig.label)
		).not.toBeInTheDocument();
	});
});
