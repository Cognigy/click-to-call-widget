import { useCallback, useEffect, useRef } from "react";
import { SipClient } from "../utils/SipClient";
import * as sounds from "../constants/sounds";
import type { SipSession } from "../utils/SipSession";
import { useWebrtcContext } from "../components/WebrtcContextProvider";

export default function useSip() {
	const config = useWebrtcContext();

	// sip user agent for currently-selected client
	const sipclient = useRef<SipClient>(null);
	// current session
	const sessionRef = useRef<SipSession>(null);

	const isRingAudioPlayingRef = useRef(false);
	const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const ringingAudioRef = useRef<HTMLAudioElement | null>(null);

	// Listeners registered by the embedder through the widget's public `on()`.
	// Kept here, not only on the client, because the client does not exist until
	// the endpoint config has loaded and is replaced whenever the SIP settings
	// change -- a listener attached to one client only would be silently lost.
	const externalListenersRef = useRef<Array<[string, (...args: any[]) => void]>>([]);

	const addExternalListener = useCallback(
		(event: string, handler: (...args: any[]) => void) => {
			externalListenersRef.current.push([event, handler]);
			sipclient.current?.on(event, handler);
		},
		[]
	);

	useEffect(() => {
		// Initialize the ringing audio element after mount to keep render pure
		if (ringingAudioRef.current) {
			return;
		}

		if (typeof Audio === "undefined") {
			// Non-browser environment (e.g., SSR or tests) – skip audio initialization
			return;
		}

		const audio = new Audio();
		audio.loop = true;
		audio.volume = 1;
		audio.onplaying = () => {
			isRingAudioPlayingRef.current = true;
		};
		audio.onpause = () => {
			isRingAudioPlayingRef.current = false;
		};
		ringingAudioRef.current = audio;

		return () => {
			// Cleanup on unmount
			if (ringingAudioRef.current === audio) {
				audio.pause();
				audio.removeAttribute("src");
				audio.load();
				ringingAudioRef.current = null;
				isRingAudioPlayingRef.current = false;
			}
		};
	}, []);
	const stopRingingAudio = () => {
		const audio = ringingAudioRef.current;
		if (!audio) return;
		audio.pause();
		audio.currentTime = 0;
		audio.removeAttribute('src');
		audio.load();
		isRingAudioPlayingRef.current = false;
	};

	/* event handlers for a sip session */
	const addSipSessionEventHandlers = (session: SipSession) => {
		session.on("ringing", () => {
			console.log(`session ${session.id} ringing`);
		});

		session.on("answered", () => {
			console.log(`session ${session.id} answered`);
			session.setActive(true);
			if (!sessionRef?.current) {
				sessionRef.current = session;
			}
		});

		session.on("terminated", () => {
			// dispatch(setVoiceCallState("terminate"));
			console.log(
				// {  },
				`session ${session.id} terminated; status ${session.status}`
			);
			session.setActive(false);
			if (sessionRef?.current) {
				sessionRef.current = null;
			}
		});

		session.on("change", () => {
			console.log(
				`got change event for session ${session.id}, resetting active calls`,
				{
					session,
				}
			);
		});
	};

	/* event handlers for our sip ua */
	const addUAEventListeners = (ua: SipClient) => {
		ua.on("connected", ({ client }) => {
			console.log({ client }, "connected");
		});

		ua.on("disconnected", ({ client }) => {
			console.log({ client }, "disconnected");
		});

		ua.on("session", (session: SipSession) => {
			console.log({ session }, "got a new session");
			sessionRef.current = session;
			addSipSessionEventHandlers(session);
		});
	};


	// Only the fields the SIP client is built from. Depending on the whole
	// context object recreated the client -- and ran the cleanup's `ua.stop()`,
	// which terminates any active call -- on every `updateSettings()`, even a
	// label change.
	const sipInfo = config?.endpointSettings?.sipConnectivityInfo;
	const wsUri = sipInfo?.wsUri;
	const realm = sipInfo?.realm;
	const sipUsername = sipInfo?.username;
	const sipPassword = sipInfo?.password;
	const userId = config?.options?.userId;

	useEffect(() => {
		try {
			if (!wsUri) {
				console.warn('[useSip] No wsUri configured, skipping SIP client initialization');
				return;
			}

			const ua = new SipClient(
				{
					fullUsername: `${userId ?? ''}@${realm}`,
					password: sipPassword,
					username: sipUsername,
				},
				{
					wsUri,
				}
			);
			sipclient.current = ua;
			for (const [event, handler] of externalListenersRef.current) {
				ua.on(event, handler);
			}
			return () => {
				const ua = sipclient.current;
				ua?.stop();
				if (ringTimeoutRef.current) {
					clearTimeout(ringTimeoutRef.current);
					ringTimeoutRef.current = null;
				}
				stopRingingAudio();
			};
		} catch (error) {
			console.error('[useSip] Failed to initialize SIP client:', error);
		}
	}, [wsUri, realm, sipUsername, sipPassword, userId]);


	const placeCall = () => {
		if (!sipclient.current) throw new Error('sipclient is not set');
		const ua = sipclient.current;
		ua.start();
		addUAEventListeners(ua);
		sipclient.current = ua;
		if (!ua) return false;

		const audio = ringingAudioRef.current;
		if (audio && !isRingAudioPlayingRef.current && audio.paused) {
			audio.src = sounds.ringing;
			audio.play();
		}

		if (ringTimeoutRef.current) {
			clearTimeout(ringTimeoutRef.current);
		}

		ringTimeoutRef.current = setTimeout(() => {
			stopRingingAudio();
			ua.call(
				`app-${config?.endpointSettings?.sipConnectivityInfo?.applicationSid}`
			);
		}, 1200);

		return true;
	};

	const stopCall = () => {
		const ua = sipclient.current;
		if (!ua) return;
		ua.stop();

		if (ringTimeoutRef.current) {
			clearTimeout(ringTimeoutRef.current);
			ringTimeoutRef.current = null;
		}
		stopRingingAudio();
	};

	return {
		startCall: placeCall,
		endCall: stopCall,
		userAgentRef: sipclient,
		addExternalListener,
	};
}
