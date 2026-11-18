import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { WebRTCClient, type EndpointConfig } from "@cognigy/click-to-call-sdk";

import { resolveUserId } from "../helpers";

interface LoadedConfig {
	config: EndpointConfig;
	userId: string;
}

function createClient(token: string): WebRTCClient | null {
	try {
		return new WebRTCClient({
			endpointUrl: token,
			disconnectAfterCall: true,
			// The SDK has no default; the widget keeps its 10 s call setup limit.
			callSetupTimeoutMs: 10000,
		});
	} catch (e) {
		// Insecure pages and old webviews lack WebRTC; the widget still renders.
		console.error("[webrtc-widget] WebRTC is unavailable, calls are disabled:", e);
		return null;
	}
}

// Without a client the config is still needed to render the widget.
async function fetchConfig(token: string): Promise<EndpointConfig> {
	const response = await fetch(token, { method: "GET" });
	if (!response.ok) throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
	return response.json();
}

// One SDK client per token (null without WebRTC); the config is loaded (and the caller ID resolved) once.
export function useWebRTCClient(token: string, explicitUserId?: string) {
	const client = useMemo(() => createClient(token), [token]);
	const [loaded, setLoaded] = useState<LoadedConfig | null>(null);
	// Read at load time only: setUserId throws once a UA exists.
	const explicitUserIdRef = useRef(explicitUserId);
	explicitUserIdRef.current = explicitUserId;

	useEffect(() => {
		let cancelled = false;
		setLoaded(null);

		(client ? client.loadConfig() : fetchConfig(token))
			.then((config) => {
				if (cancelled) return;
				const userId = resolveUserId(
					explicitUserIdRef.current,
					config.endpointSettings.endpointName
				);
				client?.setUserId(userId);
				setLoaded({ config, userId });
			})
			.catch((e) => {
				console.error("Failed to fetch WebRTC config:", e);
			});

		return () => {
			cancelled = true;
			client?.destroy().catch((e) => {
				console.error("Failed to destroy WebRTC client:", e);
			});
		};
	}, [client, token]);

	return {
		client,
		config: loaded?.config ?? null,
		userId: loaded?.userId ?? null,
	};
}
