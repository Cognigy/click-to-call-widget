import { useEffect, useRef, useState } from "preact/hooks";

interface CallDurationDisplayProps {
	isCallAnswered: boolean;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CallDurationDisplay({ isCallAnswered }: CallDurationDisplayProps) {
	const [callDuration, setCallDuration] = useState(0);
	const callStartTimeRef = useRef<number | null>(null);

	useEffect(() => {
		let durationInterval: ReturnType<typeof setInterval> | undefined;

		if (isCallAnswered) {
			callStartTimeRef.current = Date.now();
			setCallDuration(0);
			durationInterval = setInterval(() => {
				if (callStartTimeRef.current) {
					const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
					setCallDuration(elapsed);
				}
			}, 1000);
		} else {
			callStartTimeRef.current = null;
			setCallDuration(0);
		}

		return () => {
			if (durationInterval) clearInterval(durationInterval);
		};
	}, [isCallAnswered]);

	return (
		<span className="webrtc_widget_call_duration">
			{formatDuration(callDuration)}
		</span>
	);
}
