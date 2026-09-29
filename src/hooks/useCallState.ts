import { useEffect, useState } from "preact/hooks";
import type { ClientState, WebRTCClient } from "@cognigy/click-to-call-sdk";

export const IDLE_CALL_STATE: ClientState = {
	status: "idle",
	muted: false,
	session: null,
	endInfo: null,
	transcript: [],
	remoteStream: null,
	localStream: null,
};

export function useCallState(client: WebRTCClient | null): ClientState {
	const [state, setState] = useState<ClientState>(
		() => client?.getState() ?? IDLE_CALL_STATE
	);

	useEffect(() => {
		if (!client) {
			setState(IDLE_CALL_STATE);
			return;
		}
		// Resync: the state may have changed between render and subscribe.
		setState(client.getState());
		return client.subscribe(setState);
	}, [client]);

	return state;
}
