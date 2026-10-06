import { describe, it, expect, vi, beforeEach } from "vitest";
import { UA } from "jssip";
import { SipClient } from "../utils/SipClient";

const mockUaInstance = {
	on: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
	call: vi.fn(),
};

vi.mock("jssip", () => ({
	UA: vi.fn(() => mockUaInstance),
	WebSocketInterface: vi.fn(),
}));

describe("SipClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const baseClient = {
		fullUsername: "user@realm.example",
		password: "secret",
		username: "user",
	};

	it("calls without extraHeaders when no organisationId/projectId is declared (legacy endpoint)", () => {
		const client = new SipClient(baseClient, { wsUri: "wss://example.com" });

		client.call("app-123");

		expect(mockUaInstance.call).toHaveBeenCalledWith(
			"app-123",
			expect.objectContaining({ extraHeaders: [] })
		);
	});

	it("declares X-Organisation-Id/X-Project-Id/X-Endpoint-Id when all three are known", () => {
		const client = new SipClient(
			{ ...baseClient, organisationId: "org-1", projectId: "proj-1", endpointId: "endpoint-1" },
			{ wsUri: "wss://example.com" }
		);

		client.call("app-123");

		expect(mockUaInstance.call).toHaveBeenCalledWith(
			"app-123",
			expect.objectContaining({
				extraHeaders: ["X-Organisation-Id: org-1", "X-Project-Id: proj-1", "X-Endpoint-Id: endpoint-1"],
			})
		);
	});

	it("omits X-Endpoint-Id when only organisationId/projectId are known", () => {
		const client = new SipClient(
			{ ...baseClient, organisationId: "org-1", projectId: "proj-1" },
			{ wsUri: "wss://example.com" }
		);

		client.call("app-123");

		expect(mockUaInstance.call).toHaveBeenCalledWith(
			"app-123",
			expect.objectContaining({
				extraHeaders: ["X-Organisation-Id: org-1", "X-Project-Id: proj-1"],
			})
		);
	});

	it("sends no identity headers when only one of organisationId/projectId is known", () => {
		const client = new SipClient(
			{ ...baseClient, organisationId: "org-1" },
			{ wsUri: "wss://example.com" }
		);

		client.call("app-123");

		expect(mockUaInstance.call).toHaveBeenCalledWith("app-123", expect.objectContaining({ extraHeaders: [] }));
	});

	it("does not register but keeps the realm credentials for the INVITE challenge on a legacy endpoint", () => {
		new SipClient(baseClient, { wsUri: "wss://example.com" });

		expect(UA).toHaveBeenCalledWith(
			expect.objectContaining({
				uri: "sip:user@realm.example",
				password: "secret",
				authorization_user: "user",
				register: false,
			})
		);
	});

	const runtimeClient = { ...baseClient, organisationId: "org-1", projectId: "proj-1", endpointId: "endpoint-1" };

	it("does not register and uses userId with the wsUri host for a runtime endpoint", () => {
		new SipClient({ ...runtimeClient, userId: "webrtc-demo-abc" }, { wsUri: "wss://sbc.example.com:8443/ws" });

		const config = vi.mocked(UA).mock.calls[0][0];
		expect(config).toMatchObject({ uri: "sip:webrtc-demo-abc@sbc.example.com", register: false });
		expect(config).not.toHaveProperty("password");
		expect(config).not.toHaveProperty("authorization_user");
	});

	it("falls back to anonymous when a runtime endpoint has no userId", () => {
		new SipClient(runtimeClient, { wsUri: "wss://sbc.example.com" });

		expect(UA).toHaveBeenCalledWith(expect.objectContaining({ uri: "sip:anonymous@sbc.example.com" }));
	});

	it("throws on a ws:// URI (SC-8)", () => {
		expect(() => new SipClient(baseClient, { wsUri: "ws://example.com" }))
			.toThrow(/wss:/);
	});

	it("allows a wss:// URI without throwing (SC-8)", () => {
		expect(() => new SipClient(baseClient, { wsUri: "wss://example.com" }))
			.not.toThrow();
	});

	it("does not include password in emitted event data (AU-3)", () => {
		const client = new SipClient(baseClient, { wsUri: "wss://example.com" });

		// Capture the handlers SipClient registered on the JsSIP UA mock
		const registeredHandlers = mockUaInstance.on.mock.calls;

		// Find the handlers for events that previously carried { ...data, client }
		for (const evtName of ["connecting", "connected", "disconnected", "registrationFailed"]) {
			const handlerCall = registeredHandlers.find(([name]: any) => name === evtName);
			expect(handlerCall, `handler for '${evtName}' should be registered`).toBeDefined();

			// Capture what SipClient emits when the JsSIP event fires
			const emitted: any[] = [];
			client.on(evtName, (data: any) => emitted.push(data));

			// Fire the JsSIP event with some mock data
			const handler = handlerCall![1];
			handler({ someJsSipField: "value" });

			expect(emitted).toHaveLength(1);
			expect(emitted[0]).not.toHaveProperty("password");
			expect(emitted[0]).not.toHaveProperty("client");
			expect(emitted[0]).toHaveProperty("someJsSipField", "value");
		}
	});

	it("does not log the password to the console", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			new SipClient(baseClient, { wsUri: "wss://example.com" });

			for (const call of consoleSpy.mock.calls) {
				const logged = JSON.stringify(call);
				expect(logged).not.toContain("secret");
			}
		} finally {
			consoleSpy.mockRestore();
		}
	});
});
