import { describe, it, expect, vi, beforeEach } from "vitest";
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
});
