import { renderHook } from "@testing-library/preact";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import useSip from "../hooks/useSip";
import { SipClient } from "../utils/SipClient";
import { SipSession } from "../utils/SipSession";
import { useWebrtcContext } from "../components/WebrtcContextProvider";

// Mock the WebrtcContext
vi.mock("../components/WebrtcContextProvider", () => ({
	useWebrtcContext: vi.fn(),
}));

// Mock the Audio API
global.Audio = vi.fn().mockImplementation(() => ({
	play: vi.fn(),
	pause: vi.fn(),
	load: vi.fn(),
	removeAttribute: vi.fn(),
	onplaying: null,
	onpause: null,
	paused: true,
	src: "",
	loop: false,
	volume: 1,
	currentTime: 0,
}));

// Mock SipClient
vi.mock("../utils/SipClient");
vi.mock("../utils/SipSession");

describe("useSip", () => {
	const mockConfig = {
		endpointSettings: {
			sipConnectivityInfo: {
				username: "testuser",
				realm: "test.com",
				password: "testpass",
				wsUri: "wss://test.com",
				applicationSid: "123",
			},
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(useWebrtcContext as any).mockReturnValue(mockConfig);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should initialize SipClient on mount", () => {
		renderHook(() => useSip());
		expect(SipClient).toHaveBeenCalled();
	});

	it("should not initialize SipSession on mount", () => {
		renderHook(() => useSip());
		expect(SipSession).not.toHaveBeenCalled();
	});

	it("should initialize SipClient with correct config when startCall is called", () => {
		const mockStart = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: mockStart,
			on: vi.fn(),
			stop: vi.fn(),
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall();

		expect(SipClient).toHaveBeenCalledWith(
			{
				fullUsername: "@test.com",
				username: "testuser",
				password: "testpass",
				userId: undefined,
				organisationId: undefined,
				projectId: undefined,
				endpointId: undefined,
			},
			{
				wsUri: "wss://test.com",
			}
		);
		expect(mockStart).toHaveBeenCalled();
	});

	it("passes declared organisationId/projectId/endpointId through to SipClient for a runtime endpoint", () => {
		(useWebrtcContext as any).mockReturnValue({
			organisationId: "org-1",
			projectId: "proj-1",
			endpointSettings: {
				endpointId: "endpoint-1",
				sipConnectivityInfo: { wsUri: "wss://test.com" },
			},
		});

		renderHook(() => useSip());

		expect(SipClient).toHaveBeenCalledWith(
			expect.objectContaining({
				organisationId: "org-1",
				projectId: "proj-1",
				endpointId: "endpoint-1",
			}),
			expect.anything()
		);
	});

	it("does not derive endpointId from sipConnectivityInfo.applicationSid for an old-style endpoint config", () => {
		(useWebrtcContext as any).mockReturnValue({
			organisationId: "org-1",
			projectId: "proj-1",
			endpointSettings: { sipConnectivityInfo: { ...mockConfig.endpointSettings.sipConnectivityInfo } },
		});

		renderHook(() => useSip());

		expect(SipClient).toHaveBeenCalledWith(
			expect.objectContaining({ endpointId: undefined }),
			expect.anything()
		);
	});

	it("should handle startCall correctly", async () => {
		const mockCall = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: vi.fn(),
			stop: vi.fn(),
			call: mockCall,
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall();

		// Advance timers
		await vi.advanceTimersByTimeAsync(1200);

		expect(mockCall).toHaveBeenCalledWith("app-123");
	});

	it("dials the bare endpointId (no app- prefix) for a runtime endpoint (declared ids, no SIP credentials)", async () => {
		(useWebrtcContext as any).mockReturnValue({
			organisationId: "org-1",
			projectId: "proj-1",
			endpointSettings: {
				endpointId: "endpoint-1",
				sipConnectivityInfo: { wsUri: "wss://test.com" },
			},
		});

		const mockCall = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: vi.fn(),
			stop: vi.fn(),
			call: mockCall,
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall();

		await vi.advanceTimersByTimeAsync(1200);

		expect(mockCall).toHaveBeenCalledWith("endpoint-1");
	});

	// The endpoint handshake returns the ids for every endpoint; only the SIP
	// credentials tell a legacy endpoint from a runtime one.
	const legacyConfigWithIds = {
		organisationId: "org-1",
		projectId: "proj-1",
		endpointSettings: {
			endpointId: "endpoint-1",
			sipConnectivityInfo: { ...mockConfig.endpointSettings.sipConnectivityInfo },
		},
	};

	it("does not declare the endpointId to SipClient for a legacy endpoint that carries it", () => {
		(useWebrtcContext as any).mockReturnValue(legacyConfigWithIds);

		renderHook(() => useSip());

		expect(SipClient).toHaveBeenCalledWith(
			expect.objectContaining({
				organisationId: "org-1",
				projectId: "proj-1",
				endpointId: undefined,
				username: "testuser",
				password: "testpass",
			}),
			expect.anything()
		);
	});

	it("dials app-<applicationSid> for a legacy endpoint that carries the identity ids", async () => {
		(useWebrtcContext as any).mockReturnValue(legacyConfigWithIds);

		const mockCall = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: vi.fn(),
			stop: vi.fn(),
			call: mockCall,
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall();

		await vi.advanceTimersByTimeAsync(1200);

		expect(mockCall).toHaveBeenCalledWith("app-123");
	});

	it("falls back to dialing app-<applicationSid> when endpointId is missing even if organisationId/projectId are known", async () => {
		(useWebrtcContext as any).mockReturnValue({
			organisationId: "org-1",
			projectId: "proj-1",
			endpointSettings: { sipConnectivityInfo: { ...mockConfig.endpointSettings.sipConnectivityInfo } },
		});

		const mockCall = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: vi.fn(),
			stop: vi.fn(),
			call: mockCall,
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall();

		await vi.advanceTimersByTimeAsync(1200);

		expect(mockCall).toHaveBeenCalledWith("app-123");
	});

	it("should handle endCall correctly", () => {
		const mockStop = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: vi.fn(),
			stop: mockStop,
			call: vi.fn(),
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall(); // First create the client
		result.current.endCall();

		expect(mockStop).toHaveBeenCalled();
	});

	it("should handle ringing audio correctly", () => {
		const mockPlay = vi.fn();
		const mockPause = vi.fn();

		global.Audio = vi.fn().mockImplementation(() => ({
			play: mockPlay,
			pause: mockPause,
			load: vi.fn(),
			removeAttribute: vi.fn(),
			paused: true,
			src: "",
			loop: false,
			volume: 1,
			currentTime: 0,
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall();

		expect(mockPlay).toHaveBeenCalled();
	});

	it("should handle SIP session events when client is created", () => {
		const mockOn = vi.fn();
		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: mockOn,
			stop: vi.fn(),
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall(); // Create the client first

		expect(mockOn).toHaveBeenCalledWith("connected", expect.any(Function));
		expect(mockOn).toHaveBeenCalledWith("disconnected", expect.any(Function));
		expect(mockOn).toHaveBeenCalledWith("session", expect.any(Function));
	});

	it("should clear timeout and pause audio when stopping call", () => {
		const mockStop = vi.fn();
		const mockPause = vi.fn();

		(SipClient as any).mockImplementation(() => ({
			start: vi.fn(),
			on: vi.fn(),
			stop: mockStop,
		}));

		global.Audio = vi.fn().mockImplementation(() => ({
			play: vi.fn(),
			pause: mockPause,
			load: vi.fn(),
			removeAttribute: vi.fn(),
			paused: true,
			src: "",
			loop: false,
			volume: 1,
			currentTime: 0,
		}));

		const { result } = renderHook(() => useSip());
		result.current.startCall(); // First create the client
		result.current.endCall();

		expect(mockStop).toHaveBeenCalled();
		expect(mockPause).toHaveBeenCalled();
	});

	describe("addExternalListener", () => {
		it("attaches a listener registered before the client exists, and re-attaches it to a recreated client", () => {
			// No wsUri yet: no client is created on mount.
			(useWebrtcContext as any).mockReturnValue({ endpointSettings: { sipConnectivityInfo: {} } });

			const mockOn1 = vi.fn();
			(SipClient as any).mockImplementationOnce(() => ({ start: vi.fn(), on: mockOn1, stop: vi.fn() }));

			const { result, rerender } = renderHook(() => useSip());
			const handler = vi.fn();
			result.current.addExternalListener("newRTCSession", handler);

			// The endpoint config loads: first client is created, picks up the listener.
			(useWebrtcContext as any).mockReturnValue(mockConfig);
			rerender();
			expect(mockOn1).toHaveBeenCalledWith("newRTCSession", handler);

			// The SIP settings change: a second client is created, and still gets the listener.
			const mockOn2 = vi.fn();
			(SipClient as any).mockImplementationOnce(() => ({ start: vi.fn(), on: mockOn2, stop: vi.fn() }));
			(useWebrtcContext as any).mockReturnValue({
				...mockConfig,
				endpointSettings: {
					...mockConfig.endpointSettings,
					sipConnectivityInfo: { ...mockConfig.endpointSettings.sipConnectivityInfo, wsUri: "wss://other.example" },
				},
			});
			rerender();

			expect(mockOn2).toHaveBeenCalledWith("newRTCSession", handler);
		});

		it("does not recreate or stop the client for a cosmetic config change", () => {
			const mockStop = vi.fn();
			(SipClient as any).mockImplementation(() => ({ start: vi.fn(), on: vi.fn(), stop: mockStop }));

			const { rerender } = renderHook(() => useSip());
			expect(SipClient).toHaveBeenCalledTimes(1);

			// A field the client isn't built from (e.g. label) changes -- as a cosmetic
			// updateSettings() would -- so the client must not be rebuilt or stopped.
			(useWebrtcContext as any).mockReturnValue({
				...mockConfig,
				endpointSettings: { ...mockConfig.endpointSettings, webrtcWidgetConfig: { label: "New label" } },
			});
			rerender();

			expect(SipClient).toHaveBeenCalledTimes(1);
			expect(mockStop).not.toHaveBeenCalled();
		});
	});
});
