import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { WebRTCClient, type EndpointConfig } from "@cognigy/click-to-call-sdk";

import { resolveUserId } from "../helpers";

interface LoadedConfig {
	config: EndpointConfig;
	userId: string;
}

// One SDK client per token; the config is loaded (and the caller ID resolved) once.
export function useWebRTCClient(token: string, explicitUserId?: string) {
	const client = useMemo(
		() =>
			new WebRTCClient({
				endpointUrl: token,
				disconnectAfterCall: true,
				// The SDK has no default; the widget keeps its 10 s call setup limit.
				callSetupTimeoutMs: 10000,
			}),
		[token]
	);
	const [loaded, setLoaded] = useState<LoadedConfig | null>(null);
	// Read at load time only: setUserId throws once a UA exists.
	const explicitUserIdRef = useRef(explicitUserId);
	explicitUserIdRef.current = explicitUserId;

	useEffect(() => {
		let cancelled = false;
		setLoaded(null);

		client
			.loadConfig()
			.then((config) => {
				if (cancelled) return;
				const userId = resolveUserId(
					explicitUserIdRef.current,
					config.endpointSettings.endpointName
				);
				client.setUserId(userId);
				setLoaded({ config, userId });
			})
			.catch((e) => {
				console.error("Failed to fetch WebRTC config:", e);
			});

		return () => {
			cancelled = true;
			client.destroy().catch((e) => {
				console.error("Failed to destroy WebRTC client:", e);
			});
		};
	}, [client]);

	return {
		client,
		config: loaded?.config ?? null,
		userId: loaded?.userId ?? null,
	};
}
