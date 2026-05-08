import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import VoiceBotWidget from "../components/VoiceBotWidget";
import { WebrtcContextProvider } from "../components/WebrtcContextProvider";
import * as WebrtcContext from "../components/WebrtcContextProvider";
import * as HelperFunctions from "../helpers";
import mockDataJson from "../mocks/mock.json";
import type { IWebrtcContext } from "../types";

const mockData = mockDataJson as unknown as IWebrtcContext;

// Mock necessary dependencies
vi.mock("@mui/icons-material/Phone", () => ({
	default: () => <div data-testid="phone-icon">Phone Icon</div>,
}));

vi.mock("@mui/icons-material/Mic", () => ({
	default: () => <div data-testid="phone-icon">Phone Icon</div>,
}));

vi.mock("@mui/icons-material/MicOff", () => ({
	default: () => <div data-testid="phone-icon">Phone Icon</div>,
}));

vi.mock("@mui/icons-material/PhoneDisabled", () => ({
	default: () => <div data-testid="phone-icon">Phone Icon</div>,
}));

vi.mock("./AnimatedBlob", () => ({
	AnimatedBlob: () => <div data-testid="animated-blob">Animated Blob</div>,
}));

vi.mock("./CallControls", () => ({
	default: ({
		onMuteToggle,
		isMuted,
		onEndCall,
	}: {
		onMuteToggle: () => void;
		isMuted: boolean;
		onEndCall: () => void;
		isCalling: boolean;
		handleStartCall: () => void;
		status?: string;
	}) => (
		<div data-testid="call-controls">
			<button
				type="button"
				data-testid="cognigy-mute-unmute-button"
				onClick={onMuteToggle}
			>
				{isMuted ? "Unmute" : "Mute"}
			</button>
			<button
				type="button"
				data-testid="cognigy-end-call-button"
				onClick={onEndCall}
			>
				End Call
			</button>
		</div>
	),
}));

const mocks = vi.hoisted(() => {
	return {
		getLocalStore: vi.fn().mockReturnValue("true"),
	};
});
vi.mock("./PrivacyDialog", () => ({
	default: ({
		onClose,
		onContinue,
	}: {
		onClose: () => void;
		onContinue: () => void;
	}) => (
		<div data-testid="privacy-dialog">
			<button type="button" data-testid="privacy-cancel" onClick={onClose}>
				Cancel
			</button>
			<button type="button" data-testid="privacy-continue" onClick={onContinue}>
				Continue
			</button>
		</div>
	),
}));

vi.mock(import("../helpers"), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getLocalStore: mocks.getLocalStore,
	};
});

vi.stubGlobal(
	"fetch",
	vi.fn(async (url) => {
		if (url.includes("config.json")) {
			return {
				json: async () => ({
					data: {
						ENDPOINT_BASE_URL_WITH_PROTOCOL: "https://api.example.com",
					},
				}),
			};
		}
		return {
			json: async () => ({ data: mockData }),
		};
	})
);
const mockStartCall = vi.fn();
const mockUserAgentRef = {
	current: {
		on: vi.fn(),
		stop: vi.fn(),
		removeListener: vi.fn(),
	},
};

const mockOptions = {
	ui: {
		labels: {
			callButton: "Custom Call",
			endButton: "Custom End",
			listenLabel: "Custom Listening",
		},
	},
};

describe("VoiceBotWidget", () => {
	beforeEach(() => {
		vi.mock("../hooks/useSip", () => ({
			default: () => ({
				startCall: mockStartCall,
				endCall: vi.fn(),
				userAgentRef: mockUserAgentRef,
			}),
		}));

		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({...mockData, options: mockOptions});

		// Mock localStorage
		const localStorageMock = (() => {
			let store: Record<string, string> = {};
			return {
				getItem: vi.fn((key) => store[key] || null),
				setItem: vi.fn((key, value) => {
					store[key] = value.toString();
				}),
				clear: vi.fn(() => {
					store = {};
				}),
			};
		})();

		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
		});

		// Reset mocks
		mockStartCall.mockClear();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const renderComponent = () => {
		return render(
			<WebrtcContextProvider token="test-token">
				<VoiceBotWidget />
			</WebrtcContextProvider>
		);
	};

	it("renders correctly in initial state", async () => {
		const widget = renderComponent();
		if(mockData.endpointSettings.webrtcWidgetConfig?.label) {
			expect(
				widget.getByText(mockData.endpointSettings.webrtcWidgetConfig.label)
			).toBeInTheDocument();
		}
		expect(widget.getByTestId("cognigy-call-button")).toBeInTheDocument();
		expect(widget.getByTestId("phone-icon")).toBeInTheDocument();
		expect(widget.getByRole("img", { name: "AI Agent Avatar" })).toBeInTheDocument();
		expect(widget.getByText("Powered by")).toBeInTheDocument();
	});

	it("shows privacy dialog when call button is clicked and no permission is granted", () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue(null);
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({
			...mockData,
			options: mockOptions,
			settings: {
				...mockData.settings,
				privacyNotice: { ...mockData.settings.privacyNotice, enabled: true },
			},
		});

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(widget.getByTestId("cognigy-privacy-dialog")).toBeInTheDocument();
		expect(mockStartCall).not.toHaveBeenCalled();
	});

	it("starts call directly when permission is already granted", () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		expect(mockStartCall).toHaveBeenCalledTimes(1);
		expect(widget.queryByTestId("privacy-dialog")).not.toBeInTheDocument();
	});

	it("starts call after privacy dialog is accepted", () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue(null);
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({
			...mockData,
			options: mockOptions,
			settings: {
				...mockData.settings,
				privacyNotice: { ...mockData.settings.privacyNotice, enabled: true },
			},
		});

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		// Privacy dialog should be shown
		expect(widget.getByTestId("cognigy-privacy-dialog")).toBeInTheDocument();

		// Accept the privacy dialog
		fireEvent.click(widget.getByTestId("cognigy-privacy-continue"));

		// Check if localStorage is set and call is started
		expect(window.localStorage.setItem).toHaveBeenCalledWith(
			"call-privacy-permission-granted",
			"true"
		);
		expect(mockStartCall).toHaveBeenCalledTimes(1);
	});

	it("cancels the call when privacy dialog is rejected", () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue(null);
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({
			...mockData,
			options: mockOptions,
			settings: {
				...mockData.settings,
				privacyNotice: { ...mockData.settings.privacyNotice, enabled: true },
			},
		});

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		// Privacy dialog should be shown
		expect(widget.getByTestId("cognigy-privacy-dialog")).toBeInTheDocument();

		// Reject the privacy dialog
		fireEvent.click(widget.getByTestId("cognigy-privacy-cancel"));

		// Check that we're back to the initial state
		expect(
			widget.queryByTestId("cognigy-privacy-dialog")
		).not.toBeInTheDocument();
		expect(widget.getByTestId("cognigy-call-button")).toBeInTheDocument();
		expect(mockStartCall).not.toHaveBeenCalled();
	});

	it("displays call controls when call is in progress", async () => {
		const widget = renderComponent();
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");
		fireEvent.click(widget.getByRole("button", { name: "Start a call" }));

		expect(widget.getByTestId("cognigy-end-call-button")).toBeInTheDocument();
		expect(widget.getByTestId("cognigy-mute-unmute-button")).toBeInTheDocument();
	});

	it('shows CALLING state when transcription is enabled and call is initiated', async () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({
			...mockData,
			options: mockOptions,
			endpointSettings: {
				...mockData.endpointSettings,
				webrtcWidgetConfig: {
					...mockData.endpointSettings.webrtcWidgetConfig,
					transcription: {
						...mockData.endpointSettings.webrtcWidgetConfig?.transcription,
						enabled: true,
						backgroundMode: "custom",
						backgroundColor: "rgb(2, 8, 23)",
					},
				},
			},
		});

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		// Since transcription is enabled in mockData, it should show "CALLING..."
		expect(
			widget
				.getByTestId("cognigy-widget-label")
				.querySelector(".webrtc_widget_tagline")
		).toHaveTextContent("Calling...");

		// Timer should NOT be visible yet (call not answered)
		expect(
			widget
				.getByTestId("cognigy-widget-label")
				.querySelector(".webrtc_widget_call_duration")
		).toBeNull();

		// "Connecting to" message should be visible above the widget
		expect(widget.getByText(/Connecting to/)).toBeInTheDocument();
	});

	it('shows Connecting state when transcription is disabled and call is initiated', async () => {
		// Mock context with transcription disabled
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({
			...mockData,
			options: mockOptions,
			settings: {
				...mockData.settings,
				transcription: { enabled: false }
			},
			endpointSettings: {
				...mockData.endpointSettings,
				webrtcWidgetConfig: {
					...mockData.endpointSettings.webrtcWidgetConfig,
					transcription: { enabled: false }
				}
			}
		});

		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		// When transcription is disabled, it should show "Connecting..."
		expect(
			widget
				.getByTestId("cognigy-widget-label")
				.querySelector(".webrtc_widget_tagline")
		).toHaveTextContent("Connecting...");

		// Timer should NOT be visible yet (call not answered)
		expect(
			widget
				.getByTestId("cognigy-widget-label")
				.querySelector(".webrtc_widget_call_duration")
		).toBeNull();

		// "Connecting to" message should NOT be visible (transcription disabled)
		expect(widget.queryByText(/Connecting to/)).toBeNull();
	});

	it.skip("handles mute toggle correctly", async () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");
		const mockSession = {
			mute: vi.fn(),
			unmute: vi.fn(),
			terminate: vi.fn(),
		};
		vi.spyOn(require("preact/hooks"), "useRef").mockReturnValue({
			current: mockSession,
		});
		// vi.spyOn(preactHooks, "useRef").mockReturnValueOnce({
		// 	current: mockSession,
		// });
		// Setup a spy to capture the session reference

		const widget = renderComponent();
		fireEvent.click(widget.getByTestId("cognigy-call-button"));

		// Find and click the mute button
		const muteButton = await widget.getByTestId("cognigy-mute-unmute-button");
		fireEvent.click(muteButton);

		// Should call mute on the session
		expect(mockSession.mute).toHaveBeenCalledTimes(1);

		// Click again to unmute
		fireEvent.click(muteButton);

		// Should call unmute on the session
		expect(mockSession.unmute).toHaveBeenCalledTimes(1);
	});

	it.skip("handles ending call correctly", async () => {
		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");
		renderComponent();
		const startCallButton = screen.getByTestId("cognigy-call-button");
		fireEvent.click(startCallButton);

		// Find and click the end call button
		const endCallButton = await screen.findByTestId("end-call-button");
		fireEvent.click(endCallButton);

		// Verify session.terminate was called
		expect(mockUserAgentRef.current.stop).toHaveBeenCalledTimes(1);

		// Should go back to initial state
		await waitFor(() => {
			expect(screen.getByTestId("cognigy-call-button")).toBeInTheDocument();
		});
	});

	it("only renders when webrtcWidgetConfig.active is true", () => {
		// Mock the context with active set to false
		const inactiveConfig = {
			...mockData,
			endpointSettings: {
				...mockData.endpointSettings,
				webrtcWidgetConfig: {
					...mockData.endpointSettings.webrtcWidgetConfig,
					active: false,
					label: ""
				}
			},
			options: {
				userId: ""
			}
		};
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue(inactiveConfig);

		// Render with inactive config - should render hidden placeholder for DOM stability
		const { container: inactiveContainer } = renderComponent();
		const hiddenContainer = inactiveContainer.querySelector('.webrtc_widget_container');
		expect(hiddenContainer).toBeInTheDocument();
		expect(hiddenContainer).toHaveStyle({ visibility: 'hidden' });

		// Mock the context with active set to true
		const activeConfig = {
			...mockData,
			endpointSettings: {
				...mockData.endpointSettings,
				webrtcWidgetConfig: {
					...mockData.endpointSettings.webrtcWidgetConfig,
					label: "",
					active: true
				},
			},
			options: {
				userId: "",
				...mockOptions
			}
		};
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue(activeConfig);

		// Render with active config
		const { container: activeContainer } = renderComponent();
		expect(activeContainer.firstChild).not.toBeNull();
		expect(activeContainer.querySelector(".webrtc_widget_container")).toBeInTheDocument();
	});

	it("should call sendInfo method with correct parameters when session.sendInfo is invoked", async () => {
		// Mock the original JsSIP sendInfo method
		const mockOriginalSendInfo = vi.fn();
		
		// Create a mock RTCSession with the original sendInfo method
		const mockRTCSession = {
			constructor: {
				prototype: {
					sendInfo: mockOriginalSendInfo
				}
			},
			// Add other required properties to avoid errors
			direction: "outgoing",
			remote_identity: { uri: { user: "test" } },
			data: {},
			on: vi.fn(),
			answer: vi.fn(),
			terminate: vi.fn(),
			mute: vi.fn(),
			unmute: vi.fn(),
			hold: vi.fn(),
			unhold: vi.fn(),
			sendDTMF: vi.fn(),
			isEstablished: vi.fn().mockReturnValue(false),
			start_time: new Date()
		};

		// Import and create SipSession
		const { SipSession } = await import("../utils/SipSession");
		const session = new SipSession(mockRTCSession as any, {
			onSession: vi.fn(),
			pcConfig: {}
		});

		// Test data
		const testText = "test message";
		const testData = { key: "value", number: 123 };

		// Call sendInfo method
		session.sendInfo(testText, testData);

		// Verify that the original JsSIP sendInfo method was called
		expect(mockOriginalSendInfo).toHaveBeenCalledTimes(1);
		
		// Verify the call arguments - Function.prototype.call passes arguments as:
		// call(thisArg, arg1, arg2, ...)
		const callArgs = mockOriginalSendInfo.mock.calls[0];
		expect(callArgs[0]).toBe('application/json'); // contentType (first argument)
		expect(callArgs[1]).toBe(JSON.stringify({ text: testText, data: testData })); // body (second argument)

		// Verify the JSON structure
		const parsedBody = JSON.parse(callArgs[1]);
		expect(parsedBody).toEqual({
			text: testText,
			data: testData
		});
	});

	describe("isStartingCall disconnect guard", () => {
		it("should not reset call state when disconnected fires during call start", async () => {
			vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");

			const widget = renderComponent();

			fireEvent.click(widget.getByTestId("cognigy-call-button"));
			expect(mockStartCall).toHaveBeenCalledTimes(1);

			expect(
				widget
					.getByTestId("cognigy-widget-label")
					.querySelector(".webrtc_widget_tagline")
			).toBeTruthy();

			const disconnectedCall = mockUserAgentRef.current.on.mock.calls.find(
				(args: any[]) => args[0] === "disconnected"
			);
			expect(disconnectedCall).toBeDefined();
			const onDisconnected = disconnectedCall![1];

			onDisconnected();

			expect(mockUserAgentRef.current.stop).not.toHaveBeenCalled();

			expect(
				widget
					.getByTestId("cognigy-widget-label")
					.querySelector(".webrtc_widget_tagline")
			).toBeTruthy();
		});

		it("should reset call state on disconnect after call setup completes", () => {
			vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");

			renderComponent();

			const disconnectedCall = mockUserAgentRef.current.on.mock.calls.find(
				(args: any[]) => args[0] === "disconnected"
			);
			expect(disconnectedCall).toBeDefined();
			const onDisconnected = disconnectedCall![1];

			onDisconnected();

			expect(mockUserAgentRef.current.stop).toHaveBeenCalled();
		});
	});

	describe("VoiceBotWidget — updateSettings imperative handle", () => {
		it("exposes updateSettings on the widget ref", async () => {
			const ref = { current: null as any };

			vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({ ...mockData, options: mockOptions } as any);

			render(
				<WebrtcContextProvider token="test-token">
					<VoiceBotWidget ref={ref} />
				</WebrtcContextProvider>
			);

			await waitFor(() => {
				expect(ref.current).not.toBeNull();
			});

			expect(typeof ref.current.updateSettings).toBe("function");
		});

		it("updateSettings dispatches UPDATE_SETTINGS with the payload", async () => {
			const dispatchSpy = vi.fn();
			vi.spyOn(WebrtcContext, "useWebrtcDispatch").mockReturnValue(dispatchSpy);
			vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({ ...mockData, options: mockOptions } as any);

			const ref = { current: null as any };

			render(
				<WebrtcContextProvider token="test-token">
					<VoiceBotWidget ref={ref} />
				</WebrtcContextProvider>
			);

			await waitFor(() => {
				expect(ref.current).not.toBeNull();
			});

			ref.current.updateSettings({ webrtcWidgetConfig: { tagline: "New tagline" } });

			expect(dispatchSpy).toHaveBeenCalledWith({
				type: "UPDATE_SETTINGS",
				payload: { webrtcWidgetConfig: { tagline: "New tagline" } },
			});
		});
	});

	describe("Transcription functionality", () => {
		it("should emit transcription event with correct structure when handleNewInfo receives transcription data", async () => {
			const transcriptionHandler = vi.fn();
			const { SipSession } = await import("../utils/SipSession");
			
			const mockRTCSession = {
				constructor: {
					prototype: {
						sendInfo: vi.fn()
					}
				},
				direction: "outgoing",
				remote_identity: { uri: { user: "test" } },
				data: {},
				on: vi.fn(),
				answer: vi.fn(),
				terminate: vi.fn(),
				mute: vi.fn(),
				unmute: vi.fn(),
				hold: vi.fn(),
				unhold: vi.fn(),
				sendDTMF: vi.fn(),
				isEstablished: vi.fn().mockReturnValue(false),
				start_time: new Date()
			};

			const session = new SipSession(mockRTCSession as any, {
				onSession: vi.fn(),
				pcConfig: {}
			});

			// Set up transcription listener
			session.on('transcription', transcriptionHandler);

			// Simulate receiving transcription data
			const transcriptionData = {
				originator: 'remote',
				info: {
					body: JSON.stringify({
						_transcription: {
							originator: 'bot',
							messages: [
								{ text: 'Hello, how can I help you?' },
								{ text: 'I can assist with your questions.' }
							]
						}
					})
				}
			};

			session.handleNewInfo(transcriptionData);

			// Verify transcription event was emitted
			expect(transcriptionHandler).toHaveBeenCalledTimes(1);
			expect(transcriptionHandler).toHaveBeenCalledWith({
				originator: 'bot',
				messages: [
					{ text: 'Hello, how can I help you?' },
					{ text: 'I can assist with your questions.' }
				]
			});
		});

		it("should separate transcription events from regular newInfo events", async () => {
			const transcriptionHandler = vi.fn();
			const newInfoHandler = vi.fn();
			const { SipSession } = await import("../utils/SipSession");
			
			const mockRTCSession = {
				constructor: {
					prototype: {
						sendInfo: vi.fn()
					}
				},
				direction: "outgoing",
				remote_identity: { uri: { user: "test" } },
				data: {},
				on: vi.fn(),
				answer: vi.fn(),
				terminate: vi.fn(),
				mute: vi.fn(),
				unmute: vi.fn(),
				hold: vi.fn(),
				unhold: vi.fn(),
				sendDTMF: vi.fn(),
				isEstablished: vi.fn().mockReturnValue(false),
				start_time: new Date()
			};

			const session = new SipSession(mockRTCSession as any, {
				onSession: vi.fn(),
				pcConfig: {}
			});

			// Set up both listeners
			session.on('transcription', transcriptionHandler);
			session.on('newInfo', newInfoHandler);

			// Simulate receiving transcription data
			const transcriptionData = {
				originator: 'remote',
				info: {
					body: JSON.stringify({
						_transcription: {
							originator: 'bot',
							messages: [{ text: 'Transcription message' }]
						}
					})
				}
			};

			session.handleNewInfo(transcriptionData);

			// Verify only transcription event was emitted, not newInfo
			expect(transcriptionHandler).toHaveBeenCalledTimes(1);
			expect(newInfoHandler).not.toHaveBeenCalled();

			// Reset handlers
			transcriptionHandler.mockClear();
			newInfoHandler.mockClear();

			// Simulate receiving regular info data (without transcription)
			const regularInfoData = {
				originator: 'remote',
				info: {
					body: JSON.stringify({
						text: 'Regular message',
						data: { key: 'value' }
					})
				}
			};

			session.handleNewInfo(regularInfoData);

			// Verify only newInfo event was emitted, not transcription
			expect(newInfoHandler).toHaveBeenCalledTimes(1);
			expect(transcriptionHandler).not.toHaveBeenCalled();
		});

		it("should handle transcription events with different originators", async () => {
			const transcriptionHandler = vi.fn();
			const { SipSession } = await import("../utils/SipSession");
			
			const mockRTCSession = {
				constructor: {
					prototype: {
						sendInfo: vi.fn()
					}
				},
				direction: "outgoing",
				remote_identity: { uri: { user: "test" } },
				data: {},
				on: vi.fn(),
				answer: vi.fn(),
				terminate: vi.fn(),
				mute: vi.fn(),
				unmute: vi.fn(),
				hold: vi.fn(),
				unhold: vi.fn(),
				sendDTMF: vi.fn(),
				isEstablished: vi.fn().mockReturnValue(false),
				start_time: new Date()
			};

			const session = new SipSession(mockRTCSession as any, {
				onSession: vi.fn(),
				pcConfig: {}
			});

			session.on('transcription', transcriptionHandler);

			// Test bot originator
			const botTranscription = {
				originator: 'remote',
				info: {
					body: JSON.stringify({
						_transcription: {
							originator: 'bot',
							messages: [{ text: 'Bot message' }]
						}
					})
				}
			};

			session.handleNewInfo(botTranscription);
			expect(transcriptionHandler).toHaveBeenCalledWith({
				originator: 'bot',
				messages: [{ text: 'Bot message' }]
			});

			transcriptionHandler.mockClear();

			// Test user originator
			const userTranscription = {
				originator: 'remote',
				info: {
					body: JSON.stringify({
						_transcription: {
							originator: 'user',
							messages: [{ text: 'User message' }]
						}
					})
				}
			};

			session.handleNewInfo(userTranscription);
			expect(transcriptionHandler).toHaveBeenCalledWith({
				originator: 'user',
				messages: [{ text: 'User message' }]
			});
		});
	});
});
