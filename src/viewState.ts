import type { CallStatus, ClientState, TranscriptMessage } from "@cognigy/click-to-call-sdk";

export interface ViewState {
	isCalling: boolean;
	isCallAnswered: boolean;
	isMuted: boolean;
	sessionStatus: CallStatus;
	transcriptMessages: TranscriptMessage[];
	remoteStream: MediaStream | null;
	localStream: MediaStream | null;
}

const CALLING_STATUSES: ReadonlySet<CallStatus> = new Set(["connecting", "ringing", "answered"]);

export function toViewState(s: ClientState): ViewState {
	return {
		isCalling: CALLING_STATUSES.has(s.status),
		isCallAnswered: s.status === "answered",
		isMuted: s.muted,
		sessionStatus: s.status,
		transcriptMessages: s.transcript,
		remoteStream: s.remoteStream,
		localStream: s.localStream,
	};
}
