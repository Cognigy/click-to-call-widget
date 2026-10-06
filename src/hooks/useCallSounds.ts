import { useCallback, useEffect, useRef } from "preact/hooks";
import type { ClientState } from "@cognigy/click-to-call-sdk";

import * as sounds from "../constants/sounds";

function playOnce(src: string, volume: number) {
	const audio = new Audio(src);
	audio.volume = volume;
	audio.play()?.catch((e) => console.warn("[useCallSounds] playback failed:", e));
}

export function useCallSounds(state: ClientState) {
	const ringingRef = useRef<HTMLAudioElement | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const resolveRef = useRef<(() => void) | null>(null);
	const prevStatusRef = useRef(state.status);

	const stopRinging = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		const audio = ringingRef.current;
		if (audio) {
			audio.pause();
			audio.currentTime = 0;
			audio.removeAttribute("src");
			audio.load();
		}
		resolveRef.current?.();
		resolveRef.current = null;
	}, []);

	const ringFor = useCallback(
		(ms: number) => {
			stopRinging();
			if (!ringingRef.current) {
				ringingRef.current = new Audio();
				ringingRef.current.loop = true;
				ringingRef.current.volume = 1;
			}
			const audio = ringingRef.current;
			audio.src = sounds.ringing;
			audio.play()?.catch((e) => console.warn("[useCallSounds] playback failed:", e));

			return new Promise<void>((resolve) => {
				resolveRef.current = resolve;
				timerRef.current = setTimeout(stopRinging, ms);
			});
		},
		[stopRinging]
	);

	useEffect(() => {
		const prev = prevStatusRef.current;
		prevStatusRef.current = state.status;
		if (prev === state.status) return;

		if (state.status === "ended") {
			stopRinging();
			// A cancel before any session existed was never a call to hang up.
			if (state.session) playOnce(sounds.hungup, 1);
		} else if (state.status === "failed") {
			stopRinging();
			if (state.endInfo?.originator === "remote") playOnce(sounds.failed, 0.25);
		}
	}, [state.status, state.endInfo, state.session, stopRinging]);

	useEffect(() => stopRinging, [stopRinging]);

	return { ringFor, stopRinging };
}
