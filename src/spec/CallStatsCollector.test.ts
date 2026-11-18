import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	CallStatsCollector,
	toCallStatsSample,
	WEBRTC_STATS_CONTENT_TYPE,
} from "../utils/CallStatsCollector";
import { SipSession } from "../utils/SipSession";
import { FakeRTCSession } from "./fakes/fakeJssip";

function report(entries: Record<string, any>[]): RTCStatsReport {
	return new Map(entries.map((e) => [e.id, e])) as unknown as RTCStatsReport;
}

const CHROME_REPORT = report([
	{ id: "IT1", type: "inbound-rtp", kind: "audio", packetsReceived: 500, packetsLost: 4, jitter: 0.012, concealedSamples: 960, totalSamplesReceived: 480000, concealmentEvents: 3, jitterBufferDelay: 24, jitterBufferEmittedCount: 480000 },
	{ id: "OT1", type: "outbound-rtp", kind: "audio", packetsSent: 510 },
	{ id: "RI1", type: "remote-inbound-rtp", kind: "audio", packetsLost: 2, fractionLost: 0.01, roundTripTime: 0.08 },
	{ id: "MS1", type: "media-source", kind: "audio", audioLevel: 0.2, totalAudioEnergy: 1.5 },
	{ id: "IV1", type: "inbound-rtp", kind: "video", packetsReceived: 999 },
	{ id: "T1", type: "transport", iceState: "connected", dtlsState: "connected", selectedCandidatePairId: "CP1" },
	{ id: "CP1", type: "candidate-pair", localCandidateId: "L1", remoteCandidateId: "R1" },
	{ id: "L1", type: "local-candidate", candidateType: "relay", protocol: "udp", relayProtocol: "tls", address: "203.0.113.7" },
	{ id: "R1", type: "remote-candidate", candidateType: "host", protocol: "udp", address: "198.51.100.9" },
]);

class FakePc extends EventTarget {
	connectionState: RTCPeerConnectionState = "connected";
	iceConnectionState: RTCIceConnectionState = "connected";
	getStats = vi.fn(async () => CHROME_REPORT);
}

describe("toCallStatsSample", () => {
	it("maps audio RTP, mic and selected candidate pair stats", () => {
		expect(toCallStatsSample(CHROME_REPORT, "periodic", 1)).toEqual({
			v: 1,
			reason: "periodic",
			seq: 1,
			inPacketsReceived: 500,
			inPacketsLost: 4,
			inJitter: 0.012,
			concealedSamples: 960,
			totalSamplesReceived: 480000,
			concealmentEvents: 3,
			jitterBufferDelay: 24,
			jitterBufferEmittedCount: 480000,
			outPacketsSent: 510,
			outPacketsLost: 2,
			outFractionLost: 0.01,
			roundTripTime: 0.08,
			micAudioLevel: 0.2,
			micTotalAudioEnergy: 1.5,
			iceState: "connected",
			dtlsState: "connected",
			localCandidateType: "relay",
			remoteCandidateType: "host",
			protocol: "udp",
			relayProtocol: "tls",
		});
	});

	it("never includes candidate IP addresses", () => {
		const json = JSON.stringify(toCallStatsSample(CHROME_REPORT, "final", 1));
		expect(json).not.toContain("203.0.113.7");
		expect(json).not.toContain("198.51.100.9");
	});

	it("finds the selected pair on Firefox, which has no transport stats", () => {
		const sample = toCallStatsSample(
			report([
				{ id: "CP0", type: "candidate-pair", state: "failed", localCandidateId: "L0", remoteCandidateId: "R1" },
				{ id: "CP1", type: "candidate-pair", selected: true, nominated: true, state: "succeeded", localCandidateId: "L1", remoteCandidateId: "R1" },
				{ id: "L0", type: "local-candidate", candidateType: "host", protocol: "udp" },
				{ id: "L1", type: "local-candidate", candidateType: "srflx", protocol: "udp" },
				{ id: "R1", type: "remote-candidate", candidateType: "host" },
			]),
			"periodic",
			1
		);
		expect(sample.localCandidateType).toBe("srflx");
	});
});

describe("CallStatsCollector", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("sends a periodic sample with an increasing seq until stopped", async () => {
		const pc = new FakePc();
		const send = vi.fn();
		const collector = new CallStatsCollector(pc as any, send, 1000);
		collector.start();

		await vi.advanceTimersByTimeAsync(2000);
		expect(send.mock.calls.map(([s]) => [s.reason, s.seq])).toEqual([
			["periodic", 1],
			["periodic", 2],
		]);

		collector.stop();
		await vi.advanceTimersByTimeAsync(5000);
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("sends a sample as soon as ICE fails", async () => {
		const pc = new FakePc();
		const send = vi.fn();
		new CallStatsCollector(pc as any, send, 60_000);

		pc.iceConnectionState = "failed";
		pc.dispatchEvent(new Event("iceconnectionstatechange"));
		await vi.advanceTimersByTimeAsync(0);

		expect(send).toHaveBeenCalledWith(expect.objectContaining({ reason: "ice-failed" }));
	});

	it("gives up when getStats does not resolve, so hangup is not blocked", async () => {
		const pc = new FakePc();
		pc.getStats.mockReturnValue(new Promise(() => {}));
		const send = vi.fn();
		const collector = new CallStatsCollector(pc as any, send);

		const flushed = collector.flush("final", 300);
		await vi.advanceTimersByTimeAsync(300);
		await expect(flushed).resolves.toBeUndefined();
		expect(send).not.toHaveBeenCalled();
	});

	it("skips a closed peer connection", async () => {
		const pc = new FakePc();
		pc.connectionState = "closed";
		const send = vi.fn();
		await new CallStatsCollector(pc as any, send).flush("final");
		expect(pc.getStats).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});
});

vi.stubGlobal(
	"Audio",
	vi.fn(() => ({ play: vi.fn(), pause: vi.fn(), load: vi.fn(), src: "", volume: 1 }))
);

describe("SipSession stats", () => {
	function answeredSession() {
		const rtc = new FakeRTCSession();
		const pc = new FakePc();
		rtc._connection = pc;
		const sendInfo = vi.spyOn(FakeRTCSession.prototype, "sendInfo");
		const session = new SipSession(rtc as any, { onSession: vi.fn() });
		rtc.accept();
		return { rtc, session, sendInfo };
	}

	afterEach(() => vi.restoreAllMocks());

	it("sends the final sample as an INFO with the stats content type, not application/json", async () => {
		const { session, sendInfo } = answeredSession();
		const onStats = vi.fn();
		session.on("stats", onStats);

		await session.sendFinalStats();

		expect(sendInfo).toHaveBeenCalledTimes(1);
		const [contentType, body] = sendInfo.mock.calls[0];
		expect(contentType).toBe(WEBRTC_STATS_CONTENT_TYPE);
		expect(JSON.parse(body)).toMatchObject({ v: 1, reason: "final", localCandidateType: "relay" });
		expect(onStats).toHaveBeenCalledWith(expect.objectContaining({ reason: "final" }));
	});

	it("does not send after the call has ended", async () => {
		const { rtc, session, sendInfo } = answeredSession();
		rtc.terminate();

		await session.sendFinalStats();

		expect(sendInfo).not.toHaveBeenCalled();
	});
});
