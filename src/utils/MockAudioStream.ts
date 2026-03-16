/**
 * Creates a mock audio stream that simulates speech patterns.
 * Useful for testing the audio wave animation without a real call.
 */
export class MockAudioStream {
	private audioContext: AudioContext | null = null;
	private oscillator: OscillatorNode | null = null;
	private gainNode: GainNode | null = null;
	private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
	private isPlaying = false;
	private speechPattern: number[] = [];
	private patternIndex = 0;
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor() {
		this.generateSpeechPattern();
	}

	private generateSpeechPattern(): void {
		this.speechPattern = [];
		const patternLength = 100;

		for (let i = 0; i < patternLength; i++) {
			if (Math.random() > 0.3) {
				const amplitude = 0.3 + Math.random() * 0.7;
				const duration = 2 + Math.floor(Math.random() * 8);
				for (let j = 0; j < duration && i + j < patternLength; j++) {
					this.speechPattern.push(amplitude * (1 - Math.abs(j - duration / 2) / (duration / 2)));
				}
				i += duration - 1;
			} else {
				const silenceDuration = 1 + Math.floor(Math.random() * 3);
				for (let j = 0; j < silenceDuration && i + j < patternLength; j++) {
					this.speechPattern.push(0);
				}
				i += silenceDuration - 1;
			}
		}
	}

	start(): MediaStream | null {
		if (this.isPlaying) return this.mediaStreamDestination?.stream || null;

		try {
			const AudioContextClass = window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

			if (!AudioContextClass) {
				return null;
			}

			this.audioContext = new AudioContextClass();

			this.oscillator = this.audioContext.createOscillator();
			this.oscillator.type = 'sine';
			this.oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);

			this.gainNode = this.audioContext.createGain();
			this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

			this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();

			this.oscillator.connect(this.gainNode);
			this.gainNode.connect(this.mediaStreamDestination);

			this.oscillator.start();
			this.isPlaying = true;

			this.intervalId = setInterval(() => {
				this.updateGain();
			}, 80);

			return this.mediaStreamDestination.stream;
		} catch {
			this.stop();
			return null;
		}
	}

	private updateGain(): void {
		if (!this.gainNode || !this.audioContext) return;

		const targetGain = this.speechPattern[this.patternIndex] || 0;

		this.gainNode.gain.linearRampToValueAtTime(
			targetGain,
			this.audioContext.currentTime + 0.05
		);

		const freqVariation = 150 + Math.random() * 100 + targetGain * 200;
		if (this.oscillator) {
			this.oscillator.frequency.setValueAtTime(freqVariation, this.audioContext.currentTime);
		}

		this.patternIndex = (this.patternIndex + 1) % this.speechPattern.length;

		if (this.patternIndex === 0) {
			this.generateSpeechPattern();
		}
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		if (this.oscillator) {
			this.oscillator.stop();
			this.oscillator.disconnect();
			this.oscillator = null;
		}

		if (this.gainNode) {
			this.gainNode.disconnect();
			this.gainNode = null;
		}

		if (this.audioContext && this.audioContext.state !== "closed") {
			this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}

		this.mediaStreamDestination = null;
		this.isPlaying = false;
		this.patternIndex = 0;
	}

	getStream(): MediaStream | null {
		return this.mediaStreamDestination?.stream || null;
	}
}

/**
 * Simulates a conversation with alternating bot and user speech
 */
export class MockConversation {
	private botStream: MockAudioStream;
	private userStream: MockAudioStream;
	private conversationIntervalId: ReturnType<typeof setInterval> | null = null;
	private currentSpeaker: 'bot' | 'user' | 'silence' = 'silence';
	private onSpeakerChange?: (speaker: 'bot' | 'user' | 'silence') => void;

	constructor() {
		this.botStream = new MockAudioStream();
		this.userStream = new MockAudioStream();
	}

	start(onSpeakerChange?: (speaker: 'bot' | 'user' | 'silence') => void): {
		botStream: MediaStream | null;
		userStream: MediaStream | null;
	} {
		this.onSpeakerChange = onSpeakerChange;

		const botMediaStream = this.botStream.start();
		const userMediaStream = this.userStream.start();

		this.startConversationLoop();

		return {
			botStream: botMediaStream,
			userStream: userMediaStream,
		};
	}

	private startConversationLoop(): void {
		const speakingDuration = () => 2000 + Math.random() * 4000;
		const silenceDuration = () => 500 + Math.random() * 1000;

		const nextTurn = () => {
			if (this.currentSpeaker === 'silence') {
				this.currentSpeaker = Math.random() > 0.3 ? 'bot' : 'user';
			} else if (this.currentSpeaker === 'bot') {
				this.currentSpeaker = Math.random() > 0.2 ? 'silence' : 'user';
			} else {
				this.currentSpeaker = Math.random() > 0.2 ? 'silence' : 'bot';
			}

			this.onSpeakerChange?.(this.currentSpeaker);

			const duration = this.currentSpeaker === 'silence' ? silenceDuration() : speakingDuration();

			this.conversationIntervalId = setTimeout(nextTurn, duration);
		};

		this.currentSpeaker = 'bot';
		this.onSpeakerChange?.('bot');
		this.conversationIntervalId = setTimeout(nextTurn, speakingDuration());
	}

	stop(): void {
		if (this.conversationIntervalId) {
			clearTimeout(this.conversationIntervalId);
			this.conversationIntervalId = null;
		}
		this.botStream.stop();
		this.userStream.stop();
		this.currentSpeaker = 'silence';
	}

	getCurrentSpeaker(): 'bot' | 'user' | 'silence' {
		return this.currentSpeaker;
	}
}
