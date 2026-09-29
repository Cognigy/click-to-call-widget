import { useEffect, useRef, useState, useImperativeHandle, useMemo } from "preact/hooks";
import { forwardRef } from "preact/compat";

import PrivacyDialog from "./PrivacyDialog";
import { AvatarLogo } from "./AvatarLogo";
import { AudioWaveAnimation } from "./AudioWaveAnimation";
import CallControls from "./CallControls";
import TranscriptSection from "./TranscriptSection";
import { CallDurationDisplay } from "./CallDurationDisplay";
import { getLocalStore, shouldEnableEndCall } from "../helpers";
import { useWebrtcContext } from "./WebrtcContextProvider";
import { useCallState } from "../hooks/useCallState";
import { useCallSounds } from "../hooks/useCallSounds";
import { toViewState } from "../viewState";

import { CALL_PRIVACY_PERMISSION_KEY } from "../constants/constants";
import { getTheme, getThemeCSSVariables } from "../constants/themes";
import { VoiceBotWidgetContainer } from "./VoiceBotWidget.styles";

const RINGING_LEAD_IN_MS = 1200;

const VoiceBotWidget = forwardRef((_, ref) => {
	const config = useWebrtcContext();
	const client = config?.client ?? null;
	const state = useCallState(client);
	const { ringFor, stopRinging } = useCallSounds(state);

	const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
	// Bumped on end and unmount so a pending start does not place the INVITE.
	const callAttemptRef = useRef(0);
	useEffect(() => () => {
		callAttemptRef.current++;
	}, []);

	const serverConfig = config?.endpointSettings?.webrtcWidgetConfig;
	const overrides = config?.options?.widgetOverrides;
	const runtimeOverrides = config?.overrides?.webrtcWidgetConfig;
	const settingsTranscriptionEnabled = config?.settings?.transcription?.enabled;

	// updateSettings() wins over init-time widgetOverrides.
	const widgetConfig = useMemo(() => ({
		...serverConfig,
		...overrides,
		...runtimeOverrides,
	}), [serverConfig, overrides, runtimeOverrides]);

	const isTranscriptionEnabled = settingsTranscriptionEnabled || widgetConfig.transcription?.enabled;

	const theme = useMemo(() => getTheme(widgetConfig?.theme), [widgetConfig?.theme]);
	const themeCSS = useMemo(() => getThemeCSSVariables(theme), [theme]);

	// Replaced by legacy shim in Task 13.
	useImperativeHandle(ref, () => ({ on() {} }), []);

	const placeCall = async () => {
		if (!client) return;
		const attempt = ++callAttemptRef.current;
		try {
			const connecting = client.connect();
			// Handled below; avoids an unhandled rejection while the lead-in rings.
			connecting.catch(() => {});
			await ringFor(RINGING_LEAD_IN_MS);
			await connecting;
			if (attempt !== callAttemptRef.current) return;
			await client.startCall();
		} catch (error) {
			// A cancel rejects connect(); that is not an error worth logging.
			if (attempt !== callAttemptRef.current) return;
			// The client state already reflects the failure.
			console.error("[VoiceBotWidget] Call failed:", error);
		}
	};

	const handleStartCall = () => {
		const permissionGranted = getLocalStore(CALL_PRIVACY_PERMISSION_KEY);
		if (permissionGranted || !config?.settings?.privacyNotice?.enabled) {
			placeCall();
		} else {
			setShowPrivacyDialog(true);
		}
	};

	const handleEndCall = () => {
		callAttemptRef.current++;
		stopRinging();
		client?.endCall().catch((error) => {
			console.error("[VoiceBotWidget] End call failed:", error);
		});
	};

	const toggleMute = () => {
		if (!client) return;
		(state.muted ? client.unmute() : client.mute()).catch((error) => {
			console.error("[VoiceBotWidget] Mute toggle failed:", error);
		});
	};

	const onPermissionGranted = () => {
		localStorage.setItem(CALL_PRIVACY_PERMISSION_KEY, "true");
		setShowPrivacyDialog(false);
		placeCall();
	};

	if (showPrivacyDialog) {
		return (
			<PrivacyDialog onClose={() => setShowPrivacyDialog(false)} onContinue={onPermissionGranted} />
		);
	}

	if (!widgetConfig?.active) {
		return (
			<VoiceBotWidgetContainer theme={theme} style={themeCSS}>
				<div className="webrtc_widget_outer_wrapper">
					<div className="webrtc_widget_container" style={{ visibility: 'hidden' }} />
				</div>
			</VoiceBotWidgetContainer>
		);
	}

	const { isCalling, isCallAnswered, isMuted, sessionStatus, transcriptMessages, remoteStream, localStream } = toViewState(state);

	const showTranscription = isTranscriptionEnabled && isCalling;
	const hasVisibleTranscript = showTranscription && transcriptMessages.length > 0;
	const enableEndCall = shouldEnableEndCall(sessionStatus);
	const hasCustomBackground = !!(widgetConfig.transcription?.backgroundMode === "custom" && widgetConfig.transcription?.backgroundColor);
	const showConnectingMessage = isTranscriptionEnabled && isCalling && !isCallAnswered && hasCustomBackground;
	const isWaitingForTranscript = isTranscriptionEnabled && isCalling && isCallAnswered && !hasVisibleTranscript && hasCustomBackground;
	const showTranscriptArea = !!(showConnectingMessage || hasVisibleTranscript || isWaitingForTranscript);

	const getTranscriptBgColor = () => {
		if (!hasCustomBackground || !widgetConfig.transcription?.backgroundColor) return 'transparent';
		return widgetConfig.transcription.backgroundColor;
	};

	const basePanelStyle = widgetConfig.basePanelBackgroundColor
		? { backgroundColor: widgetConfig.basePanelBackgroundColor }
		: undefined;

	return (
		<VoiceBotWidgetContainer theme={theme} style={themeCSS}>
			<div className="webrtc_widget_outer_wrapper">
				<div className="webrtc_widget_content_stack">
					<TranscriptSection
						showTranscriptArea={showTranscriptArea}
						hasCustomBackground={hasCustomBackground}
						transcriptBgColor={getTranscriptBgColor()}
						hasVisibleTranscript={!!hasVisibleTranscript}
						transcriptMessages={transcriptMessages}
						theme={theme}
						agentName={widgetConfig.label}
						isWaitingForTranscript={!!isWaitingForTranscript}
						connectingLabel={`Connecting to ${widgetConfig.label || "Cognigy Voice"}...`}
					/>
					<div className={`webrtc_widget_container ${hasCustomBackground && showTranscriptArea ? 'has-custom-bg' : ''}`} style={!hasCustomBackground || !showTranscriptArea ? basePanelStyle : undefined}>
						<div className={`webrtc_widget_content_container webrtc_widget_content_container_${isCalling ? 'calling' : 'idle'}`}>
							<div className="webrtc_widget_content_logo">
								{isCalling ? (
									<AudioWaveAnimation
										isActive={isCalling}
										remoteStream={remoteStream}
										localStream={localStream}
										theme={theme}
										size={50}
									/>
								) : (
									<AvatarLogo avatarUrl={widgetConfig.avatarLogoUrl} />
								)}
							</div>
							<div className="webrtc_widget_content" data-testid="cognigy-widget-label">
								<span className="webrtc_widget_agent_name">
									{widgetConfig.label ?? ""}
								</span>
							{isCalling ? (
								isCallAnswered ? (
									<CallDurationDisplay isCallAnswered={isCallAnswered} />
								) : (
										<span className="webrtc_widget_tagline">
											{isTranscriptionEnabled ? "Calling..." : "Connecting..."}
										</span>
									)
								) : (
									widgetConfig.tagline && (
										<span className="webrtc_widget_tagline">
											{widgetConfig.tagline}
										</span>
									)
								)}
							</div>
							<CallControls
								isCalling={isCalling}
								isMuted={isMuted}
								onMuteToggle={toggleMute}
								onEndCall={handleEndCall}
								handleStartCall={handleStartCall}
								disabled={!enableEndCall}
								muteDisabled={!isCallAnswered}
							/>
						</div>
						<div className="webrtc_widget_powered_by">
							Powered by{" "}
							<a href="https://cognigy.ai" target="_blank" rel="noreferrer">
								Cognigy.AI
							</a>
						</div>
					</div>
				</div>
			</div>
		</VoiceBotWidgetContainer>
	);
});

export default VoiceBotWidget;
