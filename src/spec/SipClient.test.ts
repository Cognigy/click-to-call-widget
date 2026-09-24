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

	it("registers with the realm credentials for a legacy endpoint", () => {
		new SipClient(baseClient, { wsUri: "wss://example.com" });

		expect(UA).toHaveBeenCalledWith(
			expect.objectContaining({
				uri: "sip:user@realm.example",
				password: "secret",
				authorization_user: "user",
				register: true,
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
});
