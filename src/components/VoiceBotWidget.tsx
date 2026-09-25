import { useCallback, useEffect, useRef, useReducer, useState, useImperativeHandle, useMemo } from "preact/hooks";
import { forwardRef } from "preact/compat";

import PrivacyDialog from "./PrivacyDialog";
import { AvatarLogo } from "./AvatarLogo";
import { AudioWaveAnimation } from "./AudioWaveAnimation";
import CallControls from "./CallControls";
import TranscriptSection from "./TranscriptSection";
import { CallDurationDisplay } from "./CallDurationDisplay";
import type { TranscriptMessage } from "./TranscriptDisplay";
import { getLocalStore, shouldEnableEndCall, callReducer, initialCallState } from "../helpers";
import { CallActionType, ActionTypes } from "../types";
import type { IUpdateableSettings, IWidgetInstance } from "../types";
import { useWebrtcContext, useWebrtcDispatch } from "./WebrtcContextProvider";
import type { SipSession } from "../utils/SipSession";

import { CALL_PRIVACY_PERMISSION_KEY } from "../constants/constants";
import { getTheme, getThemeCSSVariables } from "../constants/themes";
import useSip from "../hooks/useSip";
import useDemoCall from "../hooks/useDemoCall";
import { VoiceBotWidgetContainer } from "./VoiceBotWidget.styles";

const VoiceBotWidget = forwardRef<IWidgetInstance>((_, ref) => {
	const config = useWebrtcContext();
	const webrtcDispatch = useWebrtcDispatch();
	const { startCall, userAgentRef, addExternalListener } = useSip();

	const [state, dispatch] = useReducer(callReducer, initialCallState);
	const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
	const sessionRef = useRef<SipSession | null>(null);
	const isStartingCallRef = useRef(false);
	const startingCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const serverConfig = config?.endpointSettings?.webrtcWidgetConfig;
	const overrides = config?.options?.widgetOverrides;
	const isDemoMode = config?.options?.demoMode === true;
	const settingsTranscriptionEnabled = config?.settings?.transcription?.enabled;

	const widgetConfig = useMemo(() => ({
		...serverConfig,
		...overrides,
	}), [serverConfig, overrides]);

	const isTranscriptionEnabled = settingsTranscriptionEnabled || widgetConfig.transcription?.enabled;

	const theme = useMemo(() => getTheme(widgetConfig?.theme), [widgetConfig?.theme]);
	const themeCSS = useMemo(() => getThemeCSSVariables(theme), [theme]);

	const { startDemoCall, stopDemoCall } = useDemoCall({
		isTranscriptionEnabled,
		dispatch,
	});

	const STARTING_CALL_TIMEOUT_MS = 10_000;

	const setIsStartingCall = (value: boolean) => {
		isStartingCallRef.current = value;
		if (startingCallTimeoutRef.current) {
			clearTimeout(startingCallTimeoutRef.current);
			startingCallTimeoutRef.current = null;
		}
		if (value) {
			startingCallTimeoutRef.current = setTimeout(() => {
				if (!isStartingCallRef.current) return;
				isStartingCallRef.current = false;
				startingCallTimeoutRef.current = null;
				dispatch({ type: CallActionType.END_CALL });
				sessionRef.current?.terminate(480, "Call setup timeout");
				userAgentRef.current?.stop();
			}, STARTING_CALL_TIMEOUT_MS);
		}
	};


	useEffect(() => {
		const ua = userAgentRef?.current;
		if (!ua || isDemoMode) return;

		const onDisconnected = () => {
			if (isStartingCallRef.current) {
				return;
			}
			dispatch({ type: CallActionType.END_CALL });
			ua.stop();
		};

		const onRegistrationFailed = ({ client }: any) => {
			setIsStartingCall(false);
			client.registered = false;
			setTimeout(() => {
				dispatch({ type: CallActionType.END_CALL });
			}, 500);
		};

		const onSession = (session: any) => {
			setIsStartingCall(false);
			sessionRef.current = session;
			let activePc: RTCPeerConnection | null = null;

			const syncStreamsFromPeerConnection = (pc: RTCPeerConnection) => {
				const remoteTracks = pc
					.getReceivers()
					.map((receiver) => receiver.track)
					.filter((track): track is MediaStreamTrack => !!track && track.kind === "audio");
				const localTracks = pc
					.getSenders()
					.map((sender) => sender.track)
					.filter((track): track is MediaStreamTrack => !!track && track.kind === "audio");

				const remote = remoteTracks.length > 0 ? new MediaStream(remoteTracks) : null;
				const local = localTracks.length > 0 ? new MediaStream(localTracks) : null;

				if (remote || local) {
					dispatch({ type: CallActionType.SET_STREAMS, remote, local });
				}
			};

			const attachPeerConnection = (pc: RTCPeerConnection) => {
				activePc = pc;

				pc.ontrack = (event) => {
					if (event.streams?.[0]) {
						dispatch({ type: CallActionType.SET_REMOTE_STREAM, stream: event.streams[0] });
						return;
					}

				if (event.track?.kind === "audio") {
					const audioTracks = pc
						.getReceivers()
						.map((receiver) => receiver.track)
						.filter((track): track is MediaStreamTrack => !!track && track.kind === "audio");

					if (!audioTracks.find((track) => track.id === event.track.id)) {
						audioTracks.push(event.track);
					}

					if (audioTracks.length > 0) {
						dispatch({
							type: CallActionType.SET_REMOTE_STREAM,
							stream: new MediaStream(audioTracks),
						});
					}
				}
				};

				syncStreamsFromPeerConnection(pc);
			};

			session.on("failed", () => {
				dispatch({ type: CallActionType.END_CALL });
			});
			session.on("ended", () => {
				dispatch({ type: CallActionType.END_CALL });
			});
			session.on("terminated", () => {
				dispatch({ type: CallActionType.END_CALL });
			});
			session.on("change", () => {
				dispatch({
					type: CallActionType.SYNC_SESSION,
					status: sessionRef.current?.status,
					muted: !!sessionRef.current?.muted,
				});
			});
			session.on("answered", () => {
				dispatch({ type: CallActionType.CALL_ANSWERED });
				if (activePc) {
					syncStreamsFromPeerConnection(activePc);
				}
			});

			session.on("transcription", (transcription: { originator: 'bot' | 'user'; messages: Array<{ text: string }> }) => {
				if (transcription.messages && transcription.messages.length > 0) {
					const newMessages: TranscriptMessage[] = transcription.messages.map((msg, index) => ({
						id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`,
						text: msg.text,
						originator: transcription.originator,
						timestamp: Date.now(),
					}));
					dispatch({
						type: CallActionType.UPDATE_TRANSCRIPT_MESSAGES,
						updater: (prev) => {
							const deduped = newMessages.filter((newMsg) => {
								const isDuplicate = prev.some(
									(existing) =>
										existing.text === newMsg.text &&
										existing.originator === newMsg.originator &&
										Math.abs(existing.timestamp - newMsg.timestamp) < 1000
								);
								return !isDuplicate;
							});
							return deduped.length > 0 ? [...prev, ...deduped] : prev;
						},
					});
				}
			});

			session.on("peerconnection", (pc: RTCPeerConnection) => {
				attachPeerConnection(pc);
				pc.addEventListener("negotiationneeded", () => {
					syncStreamsFromPeerConnection(pc);
				});
			});

			const currentPc = session.jssipRtcSession?._connection;
			if (currentPc) {
				attachPeerConnection(currentPc);
			}
		};

		ua.on("disconnected", onDisconnected);
		ua.on("registrationFailed", onRegistrationFailed);
		ua.on("session", onSession);

		return () => {
			ua.removeListener("disconnected", onDisconnected);
			ua.removeListener("registrationFailed", onRegistrationFailed);
			ua.removeListener("session", onSession);
			if (startingCallTimeoutRef.current) {
				clearTimeout(startingCallTimeoutRef.current);
				startingCallTimeoutRef.current = null;
			}
		};
	}, [userAgentRef?.current, isDemoMode]);

	const handleStartCall = () => {
		try {
			if (isDemoMode) {
				startDemoCall().catch((error) => {
					console.error("[VoiceBotWidget] Demo call failed:", error);
					dispatch({ type: CallActionType.END_CALL });
				});
				return;
			}

			const permissionGranted = getLocalStore(CALL_PRIVACY_PERMISSION_KEY);
			if (permissionGranted || !config?.settings?.privacyNotice?.enabled) {
				setIsStartingCall(true);
				dispatch({ type: CallActionType.START_CALL });
				startCall();
			} else {
				setShowPrivacyDialog(true);
			}
		} catch (error) {
			setIsStartingCall(false);
			console.error(error);
			dispatch({ type: CallActionType.END_CALL });
		}
	};

	const handleEndCall = () => {
		setIsStartingCall(false);
		if (isDemoMode) {
			stopDemoCall();
			return;
		}

		dispatch({ type: CallActionType.END_CALL });
		setShowPrivacyDialog(false);
		sessionRef.current?.terminate(480, "Ended by user");
		userAgentRef.current?.stop();
	};

	const toggleMute = () => {
		const nextMuted = !state.isMuted;
		dispatch({ type: CallActionType.SET_MUTED, muted: nextMuted });

		if (isDemoMode) {
			return;
		}

		if (nextMuted) {
			sessionRef.current?.mute();
		} else {
			sessionRef.current?.unmute();
		}
	};

	const onPermissionGranted = () => {
		setIsStartingCall(true);
		dispatch({ type: CallActionType.START_CALL });
		localStorage.setItem(CALL_PRIVACY_PERMISSION_KEY, "true");
		setShowPrivacyDialog(false);
		startCall();
	};

	// NOTE: `useImperativeHandle` must stay above every early return below.
	// Preact hooks are positional, so skipping it on one render and running it
	// on the next misaligns the hook list. It is also what fulfils `mainRef`
	// (WidgetRoot forwards it once the config has loaded), and `widgetConfig`
	// comes from an async fetch -- so while it sat below the
	// `!widgetConfig?.active` return, the first render always skipped it and
	// `initWebRTCWidget()` could hang forever waiting for a ref that never
	// arrived.
	//
	// `on()` goes through useSip's listener registry rather than straight to
	// the current client: the client may not exist yet, and is recreated when
	// the SIP settings change.
	const eventHandler = addExternalListener;

	const updateSettings = useCallback(
		(settings: IUpdateableSettings) => {
			webrtcDispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: settings });
		},
		[webrtcDispatch]
	);

	useImperativeHandle(
		ref,
		() => ({
			on: eventHandler,
			updateSettings,
		}),
		[eventHandler, updateSettings]
	);

	if (showPrivacyDialog) {
		return (
			<PrivacyDialog onClose={handleEndCall} onContinue={onPermissionGranted} />
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

	const { isCalling, isCallAnswered, isMuted, sessionStatus, transcriptMessages, remoteStream, localStream } = state;

	const showTranscription = isTranscriptionEnabled && isCalling;
	const hasVisibleTranscript = showTranscription && transcriptMessages.length > 0;
	const enableEndCall = shouldEnableEndCall(sessionStatus ?? "");
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
								disabled={!enableEndCall && !isDemoMode}
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
