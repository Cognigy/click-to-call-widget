import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import VoiceBotWidget from "../components/VoiceBotWidget";
import * as WebrtcContext from "../components/WebrtcContextProvider";
import * as HelperFunctions from "../helpers";
import mockDataJson from "../mocks/mock.example.json";
import type { IWebrtcContext } from "../types";

const mockStartCall = vi.fn();
const mockUserAgentRef = {
	current: {
		on: vi.fn(),
		stop: vi.fn(),
		removeListener: vi.fn(),
	},
};

vi.mock("../hooks/useSip", () => ({
	default: () => ({
		startCall: mockStartCall,
		userAgentRef: mockUserAgentRef,
	}),
}));

vi.mock("../components/AvatarLogo", () => ({
	AvatarLogo: () => <div data-testid="avatar-logo" />,
}));

vi.mock("../components/AudioWaveAnimation", () => ({
	AudioWaveAnimation: () => <div data-testid="audio-wave" />,
}));

vi.mock("../components/TranscriptDisplay", () => ({
	TranscriptDisplay: () => <div data-testid="transcript-display" />,
}));

vi.mock("@mui/icons-material/Phone", () => ({
	default: () => <div data-testid="phone-icon" />,
}));

vi.mock("@mui/icons-material/PhoneDisabled", () => ({
	default: () => <div data-testid="phone-disabled-icon" />,
}));

vi.mock("@mui/icons-material/Mic", () => ({
	default: () => <div data-testid="mic-icon" />,
}));

vi.mock("@mui/icons-material/MicOff", () => ({
	default: () => <div data-testid="mic-off-icon" />,
}));

describe("demo mode toggle behavior", () => {
	let contextValue: IWebrtcContext;

	beforeEach(() => {
		mockStartCall.mockClear();
		vi.clearAllMocks();

		contextValue = {
			...(mockDataJson as unknown as IWebrtcContext),
			options: {
				userId: "test-user",
				demoMode: true,
				widgetOverrides: {
					transcription: {
						enabled: true,
					},
					theme: "AI_PURPLE",
				},
			},
		};

		vi.spyOn(HelperFunctions, "getLocalStore").mockReturnValue("true");
		vi.spyOn(WebrtcContext, "useWebrtcContext").mockImplementation(() => contextValue);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses real call path after demo mode is turned off", () => {
		const { rerender } = render(<VoiceBotWidget />);

		// Simulate toggling demo mode OFF before clicking "Start a call".
		contextValue = {
			...contextValue,
			options: {
				...contextValue.options,
				demoMode: false,
			},
		};
		rerender(<VoiceBotWidget />);

		fireEvent.click(screen.getByTestId("cognigy-call-button"));

		// Verify real call was initiated (not demo mode)
		expect(mockStartCall).toHaveBeenCalledTimes(1);
	});

	it("does not call startCall when in demo mode", () => {
		// contextValue already has demoMode: true from beforeEach
		render(<VoiceBotWidget />);

		fireEvent.click(screen.getByTestId("cognigy-call-button"));

		// In demo mode, the real startCall should NOT be invoked
		expect(mockStartCall).not.toHaveBeenCalled();
	});
});
