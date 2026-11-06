import { describe, it, expect } from "vitest";
import { getLocalStore, resolveUserId, setLocalStore } from "../helpers";
import { COGNIGY_WEBRTC_OPTIONS } from "../constants/constants";

describe("resolveUserId", () => {
	it("explicit userId wins and is not persisted", () => {
		expect(resolveUserId("custom-user-123", "Voice Gateway #0f07")).toBe(
			"custom-user-123"
		);
		expect(getLocalStore(COGNIGY_WEBRTC_OPTIONS)).toBeNull();
	});

	it("stored userId is reused", () => {
		setLocalStore(COGNIGY_WEBRTC_OPTIONS, { userId: "stored-user" });

		expect(resolveUserId(undefined, "Voice Gateway #0f07")).toBe("stored-user");
	});

	it("generated userId matches the pattern and merges into stored options", () => {
		setLocalStore(COGNIGY_WEBRTC_OPTIONS, { other: "keep-me" });

		const userId = resolveUserId(undefined, "Voice Gateway #0f07");

		expect(userId).toMatch(/^webrtc-voicegateway0f07-[A-Za-z0-9]{8}$/);
		expect(getLocalStore(COGNIGY_WEBRTC_OPTIONS)).toEqual({
			other: "keep-me",
			userId,
		});
	});

	it('empty endpoint name falls back to "endpoint"', () => {
		expect(resolveUserId(undefined, "")).toMatch(
			/^webrtc-endpoint-[A-Za-z0-9]{8}$/
		);
	});
});
