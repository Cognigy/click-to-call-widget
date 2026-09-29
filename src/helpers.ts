import { COGNIGY_WEBRTC_OPTIONS } from "./constants/constants";

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

// Explicit ids are used as-is; generated ones persist so the caller ID survives reloads.
export function resolveUserId(
	explicitUserId: string | undefined,
	endpointName: string
): string {
	if (explicitUserId) return explicitUserId;

	const existingUserOptions = getLocalStore(COGNIGY_WEBRTC_OPTIONS) || {};
	if (existingUserOptions.userId) return existingUserOptions.userId;

	const safeName =
		(endpointName || "").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() ||
		"endpoint";
	const userId = `webrtc-${safeName}-${randomId()}`;
	setLocalStore(COGNIGY_WEBRTC_OPTIONS, { ...existingUserOptions, userId });
	return userId;
}

export const shouldEnableEndCall = (status: string) =>
	["ringing", "answered", "failed"].includes(status);
