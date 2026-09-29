import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/preact";
import type { ClientState } from "@cognigy/click-to-call-sdk";
import * as sounds from "../constants/sounds";
import { useCallSounds } from "../hooks/useCallSounds";

const idleState: ClientState = {
	status: "idle",
	muted: false,
	session: null,
	endInfo: null,
	transcript: [],
	remoteStream: null,
	localStream: null,
};

const play = vi.mocked(HTMLMediaElement.prototype.play);
const pause = vi.mocked(HTMLMediaElement.prototype.pause);

describe("useCallSounds", () => {
	let played: { src: string; volume: number; loop: boolean }[];

	beforeEach(() => {
		played = [];
		play.mockImplementation(function (this: HTMLMediaElement) {
			played.push({ src: this.src, volume: this.volume, loop: this.loop });
			return Promise.resolve();
		});
		pause.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
		play.mockReset();
		play.mockResolvedValue(undefined);
	});

	const renderSounds = (state: ClientState) =>
		renderHook((props: { state: ClientState }) => useCallSounds(props.state), {
			initialProps: { state },
		});

	it("plays hungup on ended", () => {
		const hook = renderSounds({ ...idleState, status: "answered" });
		hook.rerender({ state: { ...idleState, status: "ended" } });

		expect(played).toEqual([{ src: sounds.hungup, volume: 1, loop: false }]);
	});

	it("plays failed only for remote failures", () => {
		const hook = renderSounds({ ...idleState, status: "ringing" });
		hook.rerender({
			state: {
				...idleState,
				status: "failed",
				endInfo: { originator: "local", cause: "SETUP_TIMEOUT" },
			},
		});
		expect(played).toEqual([]);

		hook.rerender({ state: { ...idleState, status: "connecting" } });
		hook.rerender({
			state: {
				...idleState,
				status: "failed",
				endInfo: { originator: "remote", cause: "Busy" },
			},
		});
		expect(played).toEqual([{ src: sounds.failed, volume: 0.25, loop: false }]);
	});

	it("ringFor resolves after the given time and stops the tone", async () => {
		vi.useFakeTimers();
		const hook = renderSounds({ ...idleState, status: "connecting" });
		let resolved = false;
		hook.result.current.ringFor(1200).then(() => {
			resolved = true;
		});

		expect(played).toEqual([{ src: sounds.ringing, volume: 1, loop: true }]);
		await vi.advanceTimersByTimeAsync(1199);
		expect(resolved).toBe(false);
		expect(pause).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(resolved).toBe(true);
		expect(pause).toHaveBeenCalled();
	});

	it("stopRinging stops the tone early", () => {
		const hook = renderSounds({ ...idleState, status: "connecting" });
		hook.result.current.ringFor(1200);
		hook.result.current.stopRinging();

		expect(pause).toHaveBeenCalled();
	});
});
