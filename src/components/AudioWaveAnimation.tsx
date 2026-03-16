import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import styled from "@emotion/styled";
import type { Theme } from "../constants/themes";

interface AudioWaveAnimationProps {
	isActive: boolean;
	remoteStream?: MediaStream | null;
	localStream?: MediaStream | null;
	theme: Theme;
	size?: number;
}

const WaveContainer = styled.div<{ size: number; bgColor: string }>`
	width: ${(props) => props.size}px;
	height: ${(props) => props.size}px;
	border-radius: 50%;
	background-color: ${(props) => props.bgColor};
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
`;

export function AudioWaveAnimation({
	isActive,
	remoteStream,
	localStream,
	theme,
	size = 44,
}: AudioWaveAnimationProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animationFrameRef = useRef<number>();
	const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
	const localAnalyserRef = useRef<AnalyserNode | null>(null);
	const remoteSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const localSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const [initialized, setInitialized] = useState(false);
	const prevLevelsRef = useRef<number[]>([0, 0, 0, 0, 0]);
	const remotePeakRef = useRef(0.05);
	const localPeakRef = useRef(0.05);
	const activeSourceRef = useRef<"remote" | "local">("remote");

	useEffect(() => {
		if (!isActive) {
			if (audioContextRef.current && audioContextRef.current.state !== "closed") {
				audioContextRef.current.close().catch(() => {});
				audioContextRef.current = null;
			}
			remoteAnalyserRef.current = null;
			localAnalyserRef.current = null;
			setInitialized(false);
			return;
		}

		const setupAudioAnalysis = async () => {
			try {
				const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				if (!AudioContextClass) {
					return;
				}

				audioContextRef.current = new AudioContextClass();
				if (audioContextRef.current.state === 'suspended') {
					await audioContextRef.current.resume();
				}

				if (remoteStream && remoteStream.getAudioTracks().length > 0) {
					const remoteSource = audioContextRef.current.createMediaStreamSource(remoteStream);
					remoteAnalyserRef.current = audioContextRef.current.createAnalyser();
					remoteAnalyserRef.current.fftSize = 256;
					remoteAnalyserRef.current.minDecibels = -90;
					remoteAnalyserRef.current.maxDecibels = -10;
					remoteAnalyserRef.current.smoothingTimeConstant = 0.65;
					remoteSource.connect(remoteAnalyserRef.current);
					remoteSourceRef.current = remoteSource;
				}

				if (localStream && localStream.getAudioTracks().length > 0) {
					const localSource = audioContextRef.current.createMediaStreamSource(localStream);
					localAnalyserRef.current = audioContextRef.current.createAnalyser();
					localAnalyserRef.current.fftSize = 256;
					localAnalyserRef.current.minDecibels = -90;
					localAnalyserRef.current.maxDecibels = -10;
					localAnalyserRef.current.smoothingTimeConstant = 0.65;
					localSource.connect(localAnalyserRef.current);
					localSourceRef.current = localSource;
				}

				setInitialized(true);
			} catch (error) {
				if (typeof window !== 'undefined' && window.AudioContext) {
					console.error("Error setting up audio analysis:", error);
				}
			}
		};

		setupAudioAnalysis();

		return () => {
			if (remoteSourceRef.current) {
				remoteSourceRef.current.disconnect();
				remoteSourceRef.current = null;
			}
			if (localSourceRef.current) {
				localSourceRef.current.disconnect();
				localSourceRef.current = null;
			}
			if (audioContextRef.current && audioContextRef.current.state !== "closed") {
				audioContextRef.current.close().catch(() => {});
				audioContextRef.current = null;
			}
		};
	}, [isActive, remoteStream, localStream]);

	const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
	const timeDomainBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const canvasSize = size - 8;
		const numBars = 5;
		const barWidth = 3;
		const gap = 3;
		const totalWidth = numBars * barWidth + (numBars - 1) * gap;
		const startX = (canvasSize - totalWidth) / 2;
		const centerY = canvasSize / 2;
		const maxBarHeight = canvasSize * 0.65;
		const minBarHeight = 3;

		const zeroBands: number[] = [0, 0, 0, 0, 0];

		const getFrequencyBands = (analyser: AnalyserNode | null): number[] => {
			if (!analyser) return zeroBands;

			const binCount = analyser.frequencyBinCount;
			if (!frequencyBufferRef.current || frequencyBufferRef.current.length !== binCount) {
				frequencyBufferRef.current = new Uint8Array(binCount);
			}
			analyser.getByteFrequencyData(frequencyBufferRef.current);

			const bands: number[] = [];
			const bandSize = Math.floor(binCount / 5);

			for (let i = 0; i < 5; i++) {
				let sum = 0;
				const start = i * bandSize;
				const end = start + bandSize;
				for (let j = start; j < end; j++) {
					sum += frequencyBufferRef.current[j];
				}
				bands.push(sum / bandSize / 255);
			}

			return bands;
		};

		const getAudioLevel = (analyser: AnalyserNode | null): number => {
			if (!analyser) return 0;

			const fftSize = analyser.fftSize;
			if (!timeDomainBufferRef.current || timeDomainBufferRef.current.length !== fftSize) {
				timeDomainBufferRef.current = new Uint8Array(fftSize);
			}
			analyser.getByteTimeDomainData(timeDomainBufferRef.current);

			let sumSquares = 0;
			for (let i = 0; i < fftSize; i++) {
				const centered = (timeDomainBufferRef.current[i] - 128) / 128;
				sumSquares += centered * centered;
			}
			return Math.sqrt(sumSquares / fftSize);
		};

		const normalizeLevel = (rawLevel: number, peakRef: { current: number }): number => {
			const decayedPeak = peakRef.current * 0.995;
			peakRef.current = Math.max(decayedPeak, rawLevel, 0.03);
			return Math.min(1, rawLevel / peakRef.current);
		};

		const baseHeights = [0.4, 0.7, 1.0, 0.7, 0.4];
		const smoothingFactor = 0.15;
		const { primaryColor, secondaryColor } = theme;

		const render = () => {
			ctx.clearRect(0, 0, canvasSize, canvasSize);

			let levels: number[] = zeroBands;
			let audioLevel = 0;

			if (initialized && isActive) {
				const hasRemote = !!remoteAnalyserRef.current;
				const hasLocal = !!localAnalyserRef.current;
				const remoteRaw = getAudioLevel(remoteAnalyserRef.current);
				const localRaw = getAudioLevel(localAnalyserRef.current);
				const remoteLevel = normalizeLevel(remoteRaw, remotePeakRef);
				const localLevel = normalizeLevel(localRaw, localPeakRef);

				audioLevel = Math.max(
					hasRemote ? remoteLevel : 0,
					hasLocal ? localLevel : 0
				);

				if (hasRemote && hasLocal) {
					const switchDelta = 0.05;
					if (remoteLevel > localLevel + switchDelta) {
						activeSourceRef.current = "remote";
					} else if (localLevel > remoteLevel + switchDelta) {
						activeSourceRef.current = "local";
					}
				} else if (hasRemote) {
					activeSourceRef.current = "remote";
				} else if (hasLocal) {
					activeSourceRef.current = "local";
				}

				const selectedAnalyser =
					activeSourceRef.current === "remote"
						? remoteAnalyserRef.current
						: localAnalyserRef.current;

				if (selectedAnalyser) {
					levels = getFrequencyBands(selectedAnalyser);
				}
			}

			const isSpeaking = audioLevel > 0.08;

			for (let i = 0; i < numBars; i++) {
				const x = startX + i * (barWidth + gap);

				let targetHeight: number;
				if (isActive && isSpeaking) {
					const band = Math.max(0, levels[i]);
					const levelMultiplier = Math.min(1.2, (band * 1.8 + audioLevel * 0.9));
					targetHeight = minBarHeight + (maxBarHeight - minBarHeight) * levelMultiplier * baseHeights[i];
				} else if (isActive) {
					targetHeight = minBarHeight + 2;
				} else {
					targetHeight = minBarHeight;
				}

				targetHeight = Math.max(minBarHeight, Math.min(maxBarHeight, targetHeight));

				const smoothedHeight = prevLevelsRef.current[i] + (targetHeight - prevLevelsRef.current[i]) * smoothingFactor;
				prevLevelsRef.current[i] = smoothedHeight;

				const barHeight = smoothedHeight;

				const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
				gradient.addColorStop(0, primaryColor);
				gradient.addColorStop(0.5, primaryColor);
				gradient.addColorStop(1, secondaryColor);

				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 1.5);
				ctx.fill();
			}

			animationFrameRef.current = requestAnimationFrame(render);
		};

		render();

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isActive, initialized, theme, size]);

	const containerBgColor = theme.name === 'CLEAN_WHITE' ? '#1f2937' : '#374151';

	return (
		<WaveContainer
			size={size}
			bgColor={containerBgColor}
			className="webrtc_widget_audio_wave"
		>
			<canvas
				ref={canvasRef}
				width={size - 8}
				height={size - 8}
				data-testid="audio-wave-animation"
			/>
		</WaveContainer>
	);
}
