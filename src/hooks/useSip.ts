import { useEffect, useRef } from "react";
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


	useEffect(() => {
		try {
			const wsUri = config?.endpointSettings?.sipConnectivityInfo?.wsUri;
			if (!wsUri) {
				console.warn('[useSip] No wsUri configured, skipping SIP client initialization');
				return;
			}

			const ua = new SipClient(
				{
					fullUsername: `${config?.options?.userId ?? ''}@${config?.endpointSettings?.sipConnectivityInfo?.realm}`,
					password: config?.endpointSettings?.sipConnectivityInfo?.password,
					username: config?.endpointSettings?.sipConnectivityInfo?.username,
					organisationId: config?.organisationId,
					projectId: config?.projectId,
					endpointId: config?.endpointSettings?.endpointId,
				},
				{
					wsUri,
				}
			);
			sipclient.current = ua;
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [config]);


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
			// The dialed user part is no longer parsed for routing once identity is
			// declared via headers — it's forwarded as-is for CDR/logging purposes
			// only, so a bare endpointId is enough there; old-style configs (no
			// endpointId) keep dialing app-<applicationSid> as before.
			const { organisationId, projectId, endpointSettings } = config ?? {};
			const endpointId = endpointSettings?.endpointId;
			const target =
				organisationId && projectId && endpointId
					? endpointId
					: `app-${endpointSettings?.sipConnectivityInfo?.applicationSid}`;
			ua.call(target);
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
	};
}
