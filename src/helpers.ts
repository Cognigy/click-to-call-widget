import { CallActionType } from "./types";
import type { CallState, CallAction } from "./types";

export const getLocalStore = (key: string) => {
	const item = localStorage.getItem(key);
	return item ? JSON.parse(item) : null;
};

export const setLocalStore = (key: string, value: unknown) => {
	if(!value) return
	return localStorage.setItem(key, JSON.stringify(value));
};

export const webrtcConfig = {
	expiryTime: 1000 * 60 * 5, // 5 minutes
	setConfig: (config: Record<string, string>) => {
		const configWithTimestamp = {
			...config,
			timestamp: Date.now(),
		};
		window.localStorage.setItem(
			"__COGNIGY_WEBRTC_CONFIG",
			JSON.stringify(configWithTimestamp)
		);
	},
	getConfig: () => {
		const config = window.localStorage.getItem("__COGNIGY_WEBRTC_CONFIG");
		if (config) {
			const configObject = JSON.parse(config);
			if (Date.now() - configObject?.timestamp < webrtcConfig.expiryTime) {
				return configObject;
			}
		}
		return null;
	},
};

export function randomId(prefix?: string): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 8; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	if (prefix) {
		return `${prefix}-${result}`;
	}
	return result;
}

export const shouldEnableEndCall = (status: string) =>
	["ringing", "answered", "failed"].includes(status);

export const initialCallState: CallState = {
	isCalling: false,
	isCallAnswered: false,
	isMuted: false,
	sessionStatus: undefined,
	transcriptMessages: [],
	remoteStream: null,
	localStream: null,
};

export function callReducer(state: CallState, action: CallAction): CallState {
	switch (action.type) {
		case CallActionType.START_CALL:
			return { ...state, isCalling: true };
		case CallActionType.CALL_ANSWERED:
			return { ...state, isCallAnswered: true };
		case CallActionType.END_CALL:
			return initialCallState;
		case CallActionType.SET_MUTED:
			return state.isMuted === action.muted ? state : { ...state, isMuted: action.muted };
		case CallActionType.SET_SESSION_STATUS:
			return state.sessionStatus === action.status ? state : { ...state, sessionStatus: action.status };
		case CallActionType.SET_REMOTE_STREAM:
			return { ...state, remoteStream: action.stream };
		case CallActionType.SET_LOCAL_STREAM:
			return { ...state, localStream: action.stream };
		case CallActionType.SET_STREAMS:
			return { ...state, remoteStream: action.remote, localStream: action.local };
		case CallActionType.SET_TRANSCRIPT_MESSAGES:
			return { ...state, transcriptMessages: action.messages };
		case CallActionType.UPDATE_TRANSCRIPT_MESSAGES: {
			const updated = action.updater(state.transcriptMessages);
			return updated === state.transcriptMessages ? state : { ...state, transcriptMessages: updated };
		}
		case CallActionType.SYNC_SESSION: {
			if (state.sessionStatus === action.status && state.isMuted === action.muted) return state;
			return { ...state, sessionStatus: action.status, isMuted: action.muted };
		}
		default:
			return state;
	}
}

/**
 * Adds the widget's web font to <head>, at most once per page.
 *
 * Previously this appended a <link> to document.body on every mount with no
 * cleanup, so each destroy/re-init cycle stacked another duplicate onto the
 * host page.
 */
export const ensureWidgetFontLoaded = (href: string) => {
	if (typeof document === "undefined") return;
	if (document.querySelector(`link[href="${href}"]`)) return;

	const font = document.createElement("link");
	font.href = href;
	font.rel = "stylesheet";
	document.head.appendChild(font);
};
