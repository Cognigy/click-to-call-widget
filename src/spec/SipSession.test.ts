import { describe, it, expect, vi, beforeEach } from "vitest";
import { SipSession } from "../utils/SipSession";

// Minimal mock of TExtendedRTCSession — just enough to construct SipSession
// and capture the "replaces" handler.
function createMockRtcSession() {
	const handlers: Record<string, (...args: any[]) => void> = {};
	return {
		on: vi.fn((event: string, handler: (...args: any[]) => void) => {
			handlers[event] = handler;
		}),
		_connection: null,
		direction: "outgoing",
		remote_identity: { uri: { user: "test" } },
		data: {},
		isEstablished: vi.fn(() => false),
		// expose captured handlers for testing
		_handlers: handlers,
	};
}

// SipSession constructor calls new Audio() for sound effects
vi.stubGlobal(
	"Audio",
	vi.fn(() => ({
		play: vi.fn(),
		pause: vi.fn(),
		load: vi.fn(),
		src: "",
		volume: 1,
	}))
);

describe("SipSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects an inbound Replaces instead of auto-answering (AC-3)", () => {
		const mockRtcSession = createMockRtcSession();
		new SipSession(mockRtcSession as any, {
			onSession: vi.fn(),
		});

		// The constructor should have registered a "replaces" handler
		const replacesHandler = mockRtcSession._handlers["replaces"];
		expect(replacesHandler).toBeDefined();

		// Fire the replaces event with accept and reject callbacks
		const accept = vi.fn();
		const reject = vi.fn();
		replacesHandler({ accept, reject });

		expect(reject).toHaveBeenCalledTimes(1);
		expect(accept).not.toHaveBeenCalled();
	});
});
