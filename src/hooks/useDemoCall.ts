import { useEffect, useRef } from "preact/hooks";
import type { DemoAudioPlayer as DemoAudioPlayerType } from "../utils/DemoAudioPlayer";
import type { MockConversation as MockConversationType } from "../utils/MockAudioStream";
import type { TranscriptMessage } from "../components/TranscriptDisplay";
import { CallActionType } from "../types";
import type { UseDemoCallParams } from "../types";

export default function useDemoCall(params: UseDemoCallParams) {
	const { isTranscriptionEnabled, dispatch } = params;

	const mockConversationRef = useRef<MockConversationType | null>(null);
	const demoAudioPlayerRef = useRef<DemoAudioPlayerType | null>(null);
	const demoRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const demoTranscriptIndexRef = useRef(0);

	useEffect(() => {
		return () => {
			if (demoRestartTimeoutRef.current) {
				clearTimeout(demoRestartTimeoutRef.current);
			}
			if (demoAudioPlayerRef.current) {
				demoAudioPlayerRef.current.stop();
			}
			if (mockConversationRef.current) {
				mockConversationRef.current.stop();
			}
		};
	}, []);

	const startDemoCall = async () => {
		if (import.meta.env.PROD) {
			return;
		}

		dispatch({ type: CallActionType.START_CALL });
		dispatch({ type: CallActionType.CALL_ANSWERED });
		dispatch({ type: CallActionType.SET_SESSION_STATUS, status: "in-progress" });
		demoTranscriptIndexRef.current = 0;
		dispatch({ type: CallActionType.SET_TRANSCRIPT_MESSAGES, messages: [] });

		try {
			const { DemoAudioPlayer, DEMO_TRANSCRIPTS } = await import("../utils/DemoAudioPlayer");

			const player = new DemoAudioPlayer(DEMO_TRANSCRIPTS);
			await player.initialize();
			demoAudioPlayerRef.current = player;

			player.setCallbacks({
				onWordUpdate: (event) => {
					if (!isTranscriptionEnabled) return;

					dispatch({
						type: CallActionType.UPDATE_TRANSCRIPT_MESSAGES,
						updater: (prev: TranscriptMessage[]) => {
							const existingIndex = prev.findIndex(
								(msg) => msg.id === `demo-${event.transcriptIndex}`
							);

							if (existingIndex >= 0) {
								const updated = [...prev];
								updated[existingIndex] = {
									...updated[existingIndex],
									text: event.spokenText,
								};
								return updated;
							}

							return prev;
						},
					});
				},
				onTranscriptUpdate: (event) => {
					if (!isTranscriptionEnabled) return;

					if (!event.isComplete) {
						dispatch({
							type: CallActionType.UPDATE_TRANSCRIPT_MESSAGES,
							updater: (prev: TranscriptMessage[]) => {
								const exists = prev.some((msg) => msg.id === `demo-${event.transcriptIndex}`);
								if (exists) return prev;

								return [
									...prev,
									{
										id: `demo-${event.transcriptIndex}`,
										text: event.originator === "user" ? event.text : "",
										originator: event.originator,
										timestamp: Date.now(),
									},
								];
							},
						});
					} else if (event.isComplete) {
						dispatch({
							type: CallActionType.UPDATE_TRANSCRIPT_MESSAGES,
							updater: (prev: TranscriptMessage[]) => {
								const existingIndex = prev.findIndex(
									(msg) => msg.id === `demo-${event.transcriptIndex}`
								);
								if (existingIndex >= 0) {
									const updated = [...prev];
									updated[existingIndex] = {
										...updated[existingIndex],
										text: event.text,
									};
									return updated;
								}
								return prev;
							},
						});
					}
				},
				onPlaybackComplete: () => {
					if (demoAudioPlayerRef.current) {
						demoAudioPlayerRef.current.stop();
						demoAudioPlayerRef.current = null;
					}
					dispatch({ type: CallActionType.END_CALL });

					demoRestartTimeoutRef.current = setTimeout(() => {
						startDemoCall();
					}, 3000);
				},
			});

			const stream = player.getStream();
			dispatch({ type: CallActionType.SET_STREAMS, remote: stream, local: null });

			await player.start();
		} catch (error) {
			console.error("[VoiceBotWidget] Failed to start demo with TTS, falling back to mock:", error);

			const { MockConversation } = await import("../utils/MockAudioStream");
			const { DEMO_TRANSCRIPTS } = await import("../utils/DemoAudioPlayer");

			mockConversationRef.current = new MockConversation();
			const { botStream, userStream } = mockConversationRef.current.start((speaker) => {
				if (speaker !== 'silence' && isTranscriptionEnabled) {
					const transcript = DEMO_TRANSCRIPTS[demoTranscriptIndexRef.current % DEMO_TRANSCRIPTS.length];
					if (transcript.originator === speaker) {
						dispatch({
							type: CallActionType.UPDATE_TRANSCRIPT_MESSAGES,
							updater: (prev: TranscriptMessage[]) => [...prev, {
								id: `demo-${Date.now()}`,
								text: transcript.text,
								originator: transcript.originator,
								timestamp: Date.now(),
							}],
						});
						demoTranscriptIndexRef.current++;
					}
				}
			});

			dispatch({ type: CallActionType.SET_STREAMS, remote: botStream, local: userStream });
		}
	};

	const stopDemoCall = () => {
		if (demoRestartTimeoutRef.current) {
			clearTimeout(demoRestartTimeoutRef.current);
			demoRestartTimeoutRef.current = null;
		}
		if (demoAudioPlayerRef.current) {
			demoAudioPlayerRef.current.stop();
			demoAudioPlayerRef.current = null;
		}
		if (mockConversationRef.current) {
			mockConversationRef.current.stop();
			mockConversationRef.current = null;
		}
		dispatch({ type: CallActionType.END_CALL });
	};

	return { startDemoCall, stopDemoCall };
}
