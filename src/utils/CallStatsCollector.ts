/**
 * Samples RTCPeerConnection.getStats() during a call and hands each sample to
 * `send`. The server only sees its own leg of the media path; these samples add
 * the browser's view: what the jitter buffer concealed, whether the mic produced
 * audio, and which ICE candidate pair (direct or TURN relay) carried the media.
 *
 * Counters are cumulative, so the latest sample alone describes the whole call.
 * That matters because a remote hangup closes the peer connection before a final
 * sample can be taken: the last periodic sample is then all the server gets.
 */

/** Distinct from application/json, which feature-server forwards to the bot as user input. */
export const WEBRTC_STATS_CONTENT_TYPE = "application/vnd.cognigy.webrtc-stats+json";

/**
 * sbc-inbound can rate-limit INFO on WebRTC calls (SIP_INFO_RATE_LIMIT_ENABLED,
 * 10 per minute per call by default). Stats share that budget with the INFOs
 * the embedder sends as user input, so they use at most 2 per minute.
 */
export const STATS_INTERVAL_MS = 30_000;

/** Bounds how long a hangup waits for the final sample. */
export const FINAL_STATS_TIMEOUT_MS = 300;

export type CallStatsReason = "periodic" | "final" | "ice-failed";

export interface CallStatsSample {
	v: 1;
	reason: CallStatsReason;
	seq: number;
	// Media we receive (bot -> browser), as the browser plays it out.
	inPacketsReceived?: number;
	inPacketsLost?: number;
	inJitter?: number;
	concealedSamples?: number;
	totalSamplesReceived?: number;
	concealmentEvents?: number;
	jitterBufferDelay?: number;
	jitterBufferEmittedCount?: number;
	// Media we send (browser -> bot), as reported back by the far end in RTCP.
	outPacketsSent?: number;
	outPacketsLost?: number;
	outFractionLost?: number;
	roundTripTime?: number;
	// Microphone capture. A level near zero for the whole call means a muted or wrong device.
	micAudioLevel?: number;
	micTotalAudioEnergy?: number;
	// Transport. Candidate types and protocols only, never IP addresses: those are personal data.
	iceState?: string;
	dtlsState?: string;
	localCandidateType?: string;
	remoteCandidateType?: string;
	protocol?: string;
	relayProtocol?: string;
}

type StatsEntry = Record<string, any>;

export function toCallStatsSample(
	report: RTCStatsReport,
	reason: CallStatsReason,
	seq: number
): CallStatsSample {
	const sample: CallStatsSample = { v: 1, reason, seq };
	let selectedPairId: string | undefined;

	report.forEach((s: StatsEntry) => {
		if (s.kind !== undefined && s.kind !== "audio") return;
		switch (s.type) {
			case "inbound-rtp":
				Object.assign(sample, {
					inPacketsReceived: s.packetsReceived,
					inPacketsLost: s.packetsLost,
					inJitter: s.jitter,
					concealedSamples: s.concealedSamples,
					totalSamplesReceived: s.totalSamplesReceived,
					concealmentEvents: s.concealmentEvents,
					jitterBufferDelay: s.jitterBufferDelay,
					jitterBufferEmittedCount: s.jitterBufferEmittedCount,
				});
				break;
			case "outbound-rtp":
				sample.outPacketsSent = s.packetsSent;
				break;
			case "remote-inbound-rtp":
				Object.assign(sample, {
					outPacketsLost: s.packetsLost,
					outFractionLost: s.fractionLost,
					roundTripTime: s.roundTripTime,
				});
				break;
			case "media-source":
				sample.micAudioLevel = s.audioLevel;
				sample.micTotalAudioEnergy = s.totalAudioEnergy;
				break;
			case "transport":
				sample.iceState = s.iceState;
				sample.dtlsState = s.dtlsState;
				selectedPairId = s.selectedCandidatePairId;
				break;
			case "candidate-pair":
				// Firefox has no transport stats; it flags the pair instead.
				if (s.selected || (s.nominated && s.state === "succeeded")) {
					selectedPairId ??= s.id;
				}
				break;
		}
	});

	const pair: StatsEntry | undefined = selectedPairId ? report.get(selectedPairId) : undefined;
	if (pair) {
		const local: StatsEntry | undefined = report.get(pair.localCandidateId);
		const remote: StatsEntry | undefined = report.get(pair.remoteCandidateId);
		sample.localCandidateType = local?.candidateType;
		sample.remoteCandidateType = remote?.candidateType;
		sample.protocol = local?.protocol;
		sample.relayProtocol = local?.relayProtocol;
	}

	// Drop undefined fields so the INFO body stays small.
	return JSON.parse(JSON.stringify(sample));
}

export class CallStatsCollector {
	private _timer?: ReturnType<typeof setInterval>;
	private _seq = 0;
	private _stopped = false;
	private _onIceStateChange = () => {
		if (this._pc.iceConnectionState === "failed") {
			void this.flush("ice-failed");
		}
	};

	constructor(
		private _pc: RTCPeerConnection,
		private _send: (sample: CallStatsSample) => void,
		private _intervalMs = STATS_INTERVAL_MS
	) {
		this._pc.addEventListener("iceconnectionstatechange", this._onIceStateChange);
	}

	start() {
		if (this._timer || this._stopped) return;
		this._timer = setInterval(() => void this.flush("periodic"), this._intervalMs);
	}

	stop() {
		this._stopped = true;
		clearInterval(this._timer);
		this._timer = undefined;
		this._pc.removeEventListener("iceconnectionstatechange", this._onIceStateChange);
	}

	/** Takes one sample and sends it. Never rejects; gives up after `timeoutMs`. */
	async flush(reason: CallStatsReason, timeoutMs = FINAL_STATS_TIMEOUT_MS): Promise<void> {
		if (this._stopped || this._pc.connectionState === "closed") return;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			const report = await Promise.race([
				this._pc.getStats(),
				new Promise<null>((resolve) => {
					timeout = setTimeout(() => resolve(null), timeoutMs);
				}),
			]);
			if (!report || this._stopped) return;
			this._send(toCallStatsSample(report, reason, ++this._seq));
		} catch (err) {
			console.warn("[CallStatsCollector] failed to collect stats", err);
		} finally {
			clearTimeout(timeout);
		}
	}
}
