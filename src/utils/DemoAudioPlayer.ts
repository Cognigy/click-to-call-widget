export interface WordTiming {
	word: string;
	start: number;
	end: number;
}

export interface TranscriptTiming {
	text: string;
	words: WordTiming[];
	duration: number;
}

export interface TimestampsData {
	[key: string]: TranscriptTiming;
}

export interface DemoTranscript {
	originator: "bot" | "user";
	text: string;
}

export interface WordUpdateEvent {
	transcriptIndex: number;
	wordIndex: number;
	word: string;
	spokenText: string;
	fullText: string;
	isComplete: boolean;
}

export interface TranscriptUpdateEvent {
	transcriptIndex: number;
	originator: "bot" | "user";
	text: string;
	isComplete: boolean;
}

type WordUpdateCallback = (event: WordUpdateEvent) => void;
type TranscriptUpdateCallback = (event: TranscriptUpdateEvent) => void;
type PlaybackCompleteCallback = () => void;

export const DEMO_TRANSCRIPTS: DemoTranscript[] = [
	{ originator: 'bot', text: "Hello! Welcome to Cognigy AI. How can I help you today?" },
	{ originator: 'user', text: "Hi, I'd like to know about your services." },
	{ originator: 'bot', text: "Of course! We offer AI-powered conversational solutions for businesses." },
	{ originator: 'user', text: "That sounds interesting. Can you tell me more?" },
	{ originator: 'bot', text: "Certainly! Our platform enables companies to build intelligent virtual agents." },
	{ originator: 'user', text: "What industries do you support?" },
	{ originator: 'bot', text: "We support healthcare, finance, retail, and many other industries." },
	{ originator: 'bot', text: "For example, in healthcare we help automate patient scheduling, answer frequently asked questions about insurance coverage, and provide 24/7 support for common inquiries — all while seamlessly handing off to a live agent whenever the conversation requires a human touch." },
];

export class DemoAudioPlayer {
	private audioContext: AudioContext | null = null;
	private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
	private timestampsData: TimestampsData | null = null;
	private transcripts: DemoTranscript[] = [];
	private currentTranscriptIndex = 0;
	private currentWordIndex = 0;
	private animationFrameId: number | null = null;
	private isPlaying = false;
	private userPauseDuration = 1500;
	
	private currentAudioElement: HTMLAudioElement | null = null;
	private currentSourceNode: MediaElementAudioSourceNode | null = null;
	private currentEndedHandler: (() => void) | null = null;
	private currentErrorHandler: (() => void) | null = null;

	private onWordUpdate: WordUpdateCallback | null = null;
	private onTranscriptUpdate: TranscriptUpdateCallback | null = null;
	private onPlaybackComplete: PlaybackCompleteCallback | null = null;

	constructor(transcripts: DemoTranscript[]) {
		this.transcripts = transcripts;
	}

	async initialize(): Promise<void> {
		const response = await fetch("/demo-audio/timestamps.json");
		if (!response.ok) {
			throw new Error(`Failed to load timestamps: ${response.status}`);
		}
		this.timestampsData = await response.json();

		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

		if (!AudioContextClass) {
			throw new Error("AudioContext not available");
		}

		this.audioContext = new AudioContextClass();
		this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
	}

	setCallbacks(callbacks: {
		onWordUpdate?: WordUpdateCallback;
		onTranscriptUpdate?: TranscriptUpdateCallback;
		onPlaybackComplete?: PlaybackCompleteCallback;
	}): void {
		this.onWordUpdate = callbacks.onWordUpdate || null;
		this.onTranscriptUpdate = callbacks.onTranscriptUpdate || null;
		this.onPlaybackComplete = callbacks.onPlaybackComplete || null;
	}

	getStream(): MediaStream | null {
		return this.mediaStreamDestination?.stream || null;
	}

	async start(): Promise<void> {
		if (!this.audioContext || !this.timestampsData) {
			throw new Error("DemoAudioPlayer not initialized");
		}

		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}

		this.isPlaying = true;
		this.currentTranscriptIndex = 0;
		this.currentWordIndex = 0;

		await this.playNextTranscript();
	}

	stop(): void {
		this.isPlaying = false;

		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		this.cleanupCurrentAudio();

		if (this.audioContext && this.audioContext.state !== "closed") {
			this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}

		this.mediaStreamDestination = null;
		this.currentTranscriptIndex = 0;
		this.currentWordIndex = 0;
	}

	private cleanupCurrentAudio(): void {
		if (this.currentAudioElement) {
			if (this.currentEndedHandler) {
				this.currentAudioElement.removeEventListener("ended", this.currentEndedHandler);
				this.currentEndedHandler = null;
			}
			if (this.currentErrorHandler) {
				this.currentAudioElement.removeEventListener("error", this.currentErrorHandler);
				this.currentErrorHandler = null;
			}
			this.currentAudioElement.pause();
			this.currentAudioElement.src = "";
			this.currentAudioElement = null;
		}

		if (this.currentSourceNode) {
			this.currentSourceNode.disconnect();
			this.currentSourceNode = null;
		}
	}

	private async playNextTranscript(): Promise<void> {
		if (!this.isPlaying || this.currentTranscriptIndex >= this.transcripts.length) {
			this.onPlaybackComplete?.();
			return;
		}

		const transcript = this.transcripts[this.currentTranscriptIndex];

		this.onTranscriptUpdate?.({
			transcriptIndex: this.currentTranscriptIndex,
			originator: transcript.originator,
			text: transcript.text,
			isComplete: false,
		});

		if (transcript.originator === "user") {
			await this.handleUserTranscript(transcript);
		} else {
			await this.handleBotTranscript();
		}
	}

	private async handleUserTranscript(transcript: DemoTranscript): Promise<void> {
		const userIndex = this.getUserIndex(this.currentTranscriptIndex);
		const timingKey = `user-${userIndex}`;
		const timing = this.timestampsData?.[timingKey];

		if (!timing || !this.audioContext || !this.mediaStreamDestination) {
			this.onTranscriptUpdate?.({
				transcriptIndex: this.currentTranscriptIndex,
				originator: "user",
				text: transcript.text,
				isComplete: true,
			});

			await new Promise((resolve) => setTimeout(resolve, this.userPauseDuration));

			if (this.isPlaying) {
				this.currentTranscriptIndex++;
				this.currentWordIndex = 0;
				await this.playNextTranscript();
			}
			return;
		}

		this.cleanupCurrentAudio();

		const audioElement = new Audio();
		audioElement.crossOrigin = "anonymous";
		audioElement.src = `/demo-audio/${timingKey}.mp3`;
		this.currentAudioElement = audioElement;

		const sourceNode = this.audioContext.createMediaElementSource(audioElement);
		sourceNode.connect(this.mediaStreamDestination);
		sourceNode.connect(this.audioContext.destination);
		this.currentSourceNode = sourceNode;

		this.currentWordIndex = 0;

		return new Promise<void>((resolve) => {
			const clearHandlers = () => {
				this.currentEndedHandler = null;
				this.currentErrorHandler = null;
			};

			const onEnded = async () => {
				audioElement.removeEventListener("ended", onEnded);
				audioElement.removeEventListener("error", onError);
				clearHandlers();

				if (this.animationFrameId) {
					cancelAnimationFrame(this.animationFrameId);
					this.animationFrameId = null;
				}

				this.onTranscriptUpdate?.({
					transcriptIndex: this.currentTranscriptIndex,
					originator: "user",
					text: timing.text,
					isComplete: true,
				});

				await new Promise((r) => setTimeout(r, 300));

				if (this.isPlaying) {
					this.currentTranscriptIndex++;
					this.currentWordIndex = 0;
					await this.playNextTranscript();
				}

				resolve();
			};

			const onError = async () => {
				audioElement.removeEventListener("ended", onEnded);
				audioElement.removeEventListener("error", onError);
				clearHandlers();
				if (this.isPlaying) {
					this.currentTranscriptIndex++;
					this.currentWordIndex = 0;
					await this.playNextTranscript();
				}
				resolve();
			};

			this.currentEndedHandler = onEnded;
			this.currentErrorHandler = onError;
			audioElement.addEventListener("ended", onEnded);
			audioElement.addEventListener("error", onError);

			this.onTranscriptUpdate?.({
				transcriptIndex: this.currentTranscriptIndex,
				originator: "user",
				text: "",
				isComplete: false,
			});

			audioElement.play().then(() => {
				this.startWordTracking(timing, "user");
			}).catch(async () => {
				audioElement.removeEventListener("ended", onEnded);
				audioElement.removeEventListener("error", onError);
				clearHandlers();
				if (this.isPlaying) {
					this.currentTranscriptIndex++;
					this.currentWordIndex = 0;
					await this.playNextTranscript();
				}
				resolve();
			});
		});
	}

	private async handleBotTranscript(): Promise<void> {
		const botIndex = this.getBotIndex(this.currentTranscriptIndex);
		const timingKey = `bot-${botIndex}`;
		const timing = this.timestampsData?.[timingKey];

		if (!timing) {
			this.currentTranscriptIndex++;
			await this.playNextTranscript();
			return;
		}

		if (!this.audioContext || !this.mediaStreamDestination) {
			return;
		}

		this.cleanupCurrentAudio();

		const audioElement = new Audio();
		audioElement.crossOrigin = "anonymous";
		audioElement.src = `/demo-audio/${timingKey}.mp3`;
		this.currentAudioElement = audioElement;

		const sourceNode = this.audioContext.createMediaElementSource(audioElement);
		sourceNode.connect(this.mediaStreamDestination);
		sourceNode.connect(this.audioContext.destination);
		this.currentSourceNode = sourceNode;

		this.currentWordIndex = 0;

		return new Promise<void>((resolve) => {
			const clearHandlers = () => {
				this.currentEndedHandler = null;
				this.currentErrorHandler = null;
			};

			const onEnded = async () => {
				audioElement.removeEventListener("ended", onEnded);
				audioElement.removeEventListener("error", onError);
				clearHandlers();

				if (this.animationFrameId) {
					cancelAnimationFrame(this.animationFrameId);
					this.animationFrameId = null;
				}

				this.onTranscriptUpdate?.({
					transcriptIndex: this.currentTranscriptIndex,
					originator: "bot",
					text: timing.text,
					isComplete: true,
				});

				await new Promise((r) => setTimeout(r, 300));

				if (this.isPlaying) {
					this.currentTranscriptIndex++;
					this.currentWordIndex = 0;
					await this.playNextTranscript();
				}

				resolve();
			};

			const onError = async () => {
				audioElement.removeEventListener("ended", onEnded);
				audioElement.removeEventListener("error", onError);
				clearHandlers();
				if (this.isPlaying) {
					this.currentTranscriptIndex++;
					this.currentWordIndex = 0;
					await this.playNextTranscript();
				}
				resolve();
			};

			this.currentEndedHandler = onEnded;
			this.currentErrorHandler = onError;
			audioElement.addEventListener("ended", onEnded);
			audioElement.addEventListener("error", onError);

			audioElement.play().then(() => {
				this.startWordTracking(timing, "bot");
			}).catch(async () => {
				audioElement.removeEventListener("ended", onEnded);
				audioElement.removeEventListener("error", onError);
				clearHandlers();
				if (this.isPlaying) {
					this.currentTranscriptIndex++;
					this.currentWordIndex = 0;
					await this.playNextTranscript();
				}
				resolve();
			});
		});
	}

	/**
	 * Tracks word timing for synchronized transcript display.
	 * @param _originator - Kept for API consistency and potential future bot/user-specific behavior
	 */
	private startWordTracking(timing: TranscriptTiming, _originator: "bot" | "user"): void {
		const trackWords = () => {
			if (!this.isPlaying || !this.currentAudioElement) {
				return;
			}

			const currentTime = this.currentAudioElement.currentTime;

			while (
				this.currentWordIndex < timing.words.length &&
				currentTime >= timing.words[this.currentWordIndex].start
			) {
				const wordTiming = timing.words[this.currentWordIndex];

				const spokenWords = timing.words
					.slice(0, this.currentWordIndex + 1)
					.map((w) => w.word)
					.join(" ");

				this.onWordUpdate?.({
					transcriptIndex: this.currentTranscriptIndex,
					wordIndex: this.currentWordIndex,
					word: wordTiming.word,
					spokenText: spokenWords,
					fullText: timing.text,
					isComplete: this.currentWordIndex === timing.words.length - 1,
				});

				this.currentWordIndex++;
			}

			if (this.currentWordIndex < timing.words.length) {
				this.animationFrameId = requestAnimationFrame(trackWords);
			}
		};

		this.animationFrameId = requestAnimationFrame(trackWords);
	}

	private getBotIndex(transcriptIndex: number): number {
		let botCount = 0;
		for (let i = 0; i < transcriptIndex; i++) {
			if (this.transcripts[i].originator === "bot") {
				botCount++;
			}
		}
		return botCount;
	}

	private getUserIndex(transcriptIndex: number): number {
		let userCount = 0;
		for (let i = 0; i < transcriptIndex; i++) {
			if (this.transcripts[i].originator === "user") {
				userCount++;
			}
		}
		return userCount;
	}
}
