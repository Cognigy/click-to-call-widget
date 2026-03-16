import events from "events";
import { Grammar, C } from "jssip";
import type { IncomingResponse } from "jssip/lib/SIPMessage";
import { randomId } from "../helpers";
import type { SessionOptions } from "../types";
import type { IEndInfo } from "../types";
import type { TExtendedRTCSession } from "../types";
import * as sounds from "../constants/sounds";

export class SipSession extends events.EventEmitter {
	private _onSession: (rtcSession: TExtendedRTCSession) => void;
	private _pcConfig?: RTCConfiguration;
	private _id: string;
	private _startTime: Date;
	private _status: "init" | "ringing" | "answered" | "failed" | "ended";
	private _active: boolean;
	private _endInfo: IEndInfo;
	private _muted: boolean;
	private _localHold: boolean;
	private _remoteHold: boolean;
	private _rtcSession: TExtendedRTCSession;
	private _doingAttendedTransfer: boolean;
	private _autoMerge: boolean;
	private _hungUpAudio: HTMLAudioElement;
	private _failedAudio: HTMLAudioElement;
	private _remoteAudio: HTMLAudioElement;

	constructor(rtcSession: TExtendedRTCSession, options: SessionOptions) {
		super();
		this.setMaxListeners(Number.POSITIVE_INFINITY);

		// Save given onSession handler for received INVITE with Replaces.
		this._onSession = options.onSession;

		// Save given RTCPeerConnection config.
		this._pcConfig = options.pcConfig;

		// Random unique id.
		this._id = randomId();

		// When the call starts.
		this._startTime = new Date();

		// Call status: 'init' / 'ringing' / 'answered' / 'failed' / 'ended'.
		this._status = "init";

		// Whether this call is the active one.
		this._active = false;

		// End cause.
		this._endInfo = {
			originator: null,
			cause: null,
			description: null,
		};

		// Muted, and local/remote hold status.
		this._muted = false;
		this._localHold = false;
		this._remoteHold = false;

		// JsSIP.RTCSession instance.
		this._rtcSession = rtcSession;

		// Whether attended transfer is being performed.
		this._doingAttendedTransfer = false;

		// Flag indicating that this session is marked for auto merging.
		this._autoMerge = false;

		// Audio element for failed call.
		this._failedAudio = new Audio();
		this._failedAudio.src = sounds.failed;
		this._failedAudio.volume = 0.25;

		// Audio element for answered call.
		this._hungUpAudio = new Audio();
		this._hungUpAudio.src = sounds.hungup;
		this._hungUpAudio.volume = 1;

		// Audio element for remote audio.
		this._remoteAudio = new Audio();

		const _attachPCListeners = (pc: RTCPeerConnection) => {
			pc.addEventListener("addstream", (event: any) => {
				const stream = event.stream;

				// Play the remote stream.
				this._remoteAudio.srcObject = stream;
				const playPromise = this._remoteAudio.play();
				if (playPromise instanceof Promise) {
					playPromise
						.then(() => {
							console.log("remote audio started");
						})
						.catch((err) => {
							console.log(
								"remote audio failed to start (probably due to quick answer:",
								err
							);
						});
				}
			});

			pc.addEventListener("track", (event: any) => {
				const track = event.track;
				const stream = new MediaStream();
				stream.addTrack(track);
				if (this.isOutgoing()) {

					this._remoteAudio.srcObject = stream;
					const playPromise = this._remoteAudio.play();
					if (playPromise instanceof Promise) {
						playPromise
					}
				}
			});
		};

		if (this._rtcSession._connection) {
			_attachPCListeners(this._rtcSession._connection);
			this.emit("peerconnection", this._rtcSession._connection);
		} else {
			this._rtcSession.on("peerconnection", (data) => {
				const pc = data.peerconnection;
				_attachPCListeners(pc);
				this.emit("peerconnection", pc);
			});
		}

		this._rtcSession.on("progress", () => {
			// console.log("Got here => -> progress");

			this._status = "ringing";
			this.emit("change");
			this.emit("ringing");
		});

		this._rtcSession.on("accepted", () => {
			// console.log("Got here => -> accepted");
			this._status = "answered";
			this.emit("change");
			this.emit("answered");
		});

		this._rtcSession.on("newInfo", this.handleNewInfo.bind(this));

		this._rtcSession.on("failed", (data) => {
			// console.log("Got here => -> failed");
			const { originator, cause, message } = data;
			let description: string | null = null;
			let closeDelay = 1500;

			if (
				message &&
				originator === "remote" &&
				(message as IncomingResponse).status_code
			) {
				description = `${(message as IncomingResponse).status_code}`.trim();
			}

			this._endInfo = {
				originator: originator,
				cause: cause,
				description: description,
			};

			this._status = "failed";
			this.emit("change");

			if (
				originator === "local" &&
				(cause === C.causes.CANCELED || cause === C.causes.REJECTED)
			) {
				closeDelay = 1000;
			}

			setTimeout(() => this.emit("close"), closeDelay);

			// If closed by the remote, play failed sound.
			if (originator === "remote") {
				console.log("playing failed sound");
				this._failedAudio.play();
			}

			this.emit("failed");
		});

		this._rtcSession.on("ended", (data) => {
			// console.log("Got here => -> ended");
			const { originator, cause, message } = data;
			let description: string | null = null;
			let closeDelay = 1500;

			this._hungUpAudio.play();

			if (message && originator === "remote" && message.hasHeader("Reason")) {
				const reason = Grammar.parse(
					message.getHeader("Reason"),
					"Reason"
				);
				if (reason) {
					description = `${reason.cause}`.trim();
				}
			}

			this._endInfo = {
				originator: originator,
				cause: cause,
				description: description,
			};

			this._status = "ended";
			this.emit("change");

			if (originator === "local" && cause === C.causes.BYE) {
				closeDelay = 1000;
			}

			setTimeout(() => this.emit("close"), closeDelay);
			this.emit("terminated");
		});

		this._rtcSession.on("muted", () => {
			// console.log("Got here => -> muted");
			this._muted = true;
			this.emit("change");
		});

		this._rtcSession.on("unmuted", () => {
			// console.log("Got here => -> unmuted");

			this._muted = false;
			this.emit("change");
		});

		this._rtcSession.on("sdp", (evt) => {
			/**
			 * Firefox by default uses OPUS codec and sends stereo enabled (2 channels of audio),
			 * and we need SDP to be single channel, like the other browsers (Chrome, Edge, etc),
			 * to have a better speech recognition
			 * */
			if (evt.sdp.includes("opus") && evt.sdp.includes("stereo=1")) {
				evt.sdp = evt.sdp.replace("stereo=1", "stereo=0");
			}
		});

		this._rtcSession.on("hold", (data) => {
			// console.log("Got here => -> hold");

			switch (data.originator) {
				case "local":
					this._localHold = true;
					this.emit("change");
					break;
				case "remote":
					this._remoteHold = true;
					this.emit("change");
					break;
				default:
					break;
			}
		});

		this._rtcSession.on("unhold", (data) => {
			// console.log("Got here => -> unhold");

			switch (data.originator) {
				case "local":
					this._localHold = false;
					this.emit("change");
					break;
				case "remote":
					this._remoteHold = false;
					this.emit("change");
					break;
				default:
					break;
			}
		});

		this._rtcSession.on("refer", (data) => {
			// console.log("Got here => -> refer");

			const { request, accept } = data;
			// Let's always accept incoming REFERs.
			accept(
				(rtcSession: TExtendedRTCSession) => {
					// Set the replaces flag into the session so it won't play ringing.
					//@ts-ignore
					// TODO: this might not work - typings indicate that IncomingRequest has no refer_to property.
					if (request.refer_to.uri.hasHeader("replaces")) {
						rtcSession.data.replaces = true;
					}
					this._onSession(rtcSession);
				},
				{
					mediaConstraints: { audio: true, video: false },
					pcConfig: this._pcConfig,
				}
			);
		});

		this._rtcSession.on("replaces", (data) => {
			// console.log("Got here -> replaces");

			const { accept } = data;
			accept((rtcSession: TExtendedRTCSession) => {
				// Set the replaces flag into the session so it won't ring.
				rtcSession.data.replaces = true;
				this._onSession(rtcSession);

				// Auto-answer (unless already answered).
				if (!rtcSession.isEstablished()) {
					rtcSession.answer({
						mediaConstraints: { audio: true, video: false },
						pcConfig: this._pcConfig,
					});
				}
			});
		});

		const candidateTypes: Record<string, number> = {
			host: 0,
			srflx: 0,
			relay: 0,
		};

		this._rtcSession.on("icecandidate", (evt) => {
			// console.log("Got here => -> icecandidate");
			// only care about srflx candidates right now
			// get the host
			const type = evt.candidate.candidate.split(" ");
			candidateTypes[type[7]]++;
			if (candidateTypes["srflx"] >= 1 || candidateTypes["relay"] >= 1) {
				evt.ready();
			}
		});

		this._rtcSession.on("confirmed", () => {
			console.log("Got here => -> started");
		});

		// Override the sendInfo method with our custom implementation
		this._rtcSession.sendInfo = this.sendInfo.bind(this);
	}

	get jssipRtcSession() {
		return this._rtcSession;
	}

	get id() {
		return this._id;
	}

	get direction() {
		return this.isOutgoing() ? "out" : "in";
	}

	get number() {
		return this._rtcSession.remote_identity.uri.user;
	}

	get originalNumber() {
		return this._rtcSession.data.originalNumber || this.number;
	}

	get status() {
		return this._status;
	}

	get disposition() {
		const causes = C.causes;
		const cause = this._endInfo.cause;

		switch (this._status) {
			case "failed": {
				switch (cause) {
					case causes.CANCELED:
					case causes.NO_ANSWER:
					case causes.EXPIRES:
						return "missed";
					default:
						return "rejected";
				}
			}
			case "ended": {
				return "answered";
			}
			default:
				throw new Error("cannot get call disposition while not terminated");
		}
	}

	get answered() {
		return this._status === "answered";
	}

	get terminated() {
		return this._status === "failed" || this._status === "ended";
	}

	get endInfo() {
		return this._endInfo;
	}

	get active() {
		return this._active;
	}

	get startTime() {
		return this._startTime;
	}

	get answerTime() {
		return this._rtcSession.start_time;
	}

	get duration() {
		if (!this.answerTime) {
			return 0;
		}

		const now = new Date();
		return Math.floor((now.getTime() - this.answerTime.getTime()) / 1000);
	}

	get muted() {
		return this._muted;
	}

	get localHold() {
		return this._localHold;
	}

	get remoteHold() {
		return this._remoteHold;
	}

	get autoMerge() {
		return this._autoMerge;
	}

	set autoMerge(flag) {
		if (this._autoMerge === flag) {
			return;
		}

		this._autoMerge = flag;
		this.emit("change");
	}

	get doingAttendedTransfer() {
		return this._doingAttendedTransfer;
	}

	get replaces() {
		return Boolean(this._rtcSession.data.replaces);
	}

	isOutgoing() {
		return this._rtcSession.direction === "outgoing";
	}

	isIncoming() {
		return this._rtcSession.direction === "incoming";
	}

	setActive(flag: boolean) {
		const wasActive = this._active;
		this._active = flag;

		if (this._rtcSession.isEstablished()) {
			if (this.replaces) {
				return;
			}
			if (this._active) {
				this.unhold();
			} else {
				this.hold();
			}
		}

		if (this._active && !wasActive) {
			this.emit("active");
		}
	}

	answer() {
		this._rtcSession.answer({
			mediaConstraints: { audio: true, video: false },
			pcConfig: this._pcConfig,
		});

		// NOTE: Hack. The JsSIP.RTCSession.isEstablished() return true after
		// answer(), but the 'accepted' event takes a bit to fire (getUserMedia)
		// so let's hardcode it.
		if (this._rtcSession.isEstablished()) {
			this._status = "answered";
		}
	}

	terminate(sipCode: number, sipReason: string) {
		this._rtcSession.terminate({
			status_code: sipCode,
			reason_phrase: sipReason,
		});
	}

	mute() {
		console.log("muting");
		this._rtcSession.mute({ audio: true, video: true });
	}

	unmute() {
		console.log("unmuting");
		this._rtcSession.unmute({ audio: true, video: true });
	}

	hold() {
		this._rtcSession.hold();
	}

	unhold() {
		this._rtcSession.unhold();
	}

	sendDtmf = (tones: string | number) => {
		this._rtcSession.sendDTMF(tones);
	};

	sendInfo(text: string, data: Record<string, any>) {
		// Call the original JsSIP sendInfo method directly
		(this._rtcSession as any).constructor.prototype.sendInfo.call(
			this._rtcSession,
			'application/json',
			JSON.stringify({ text, data })
		);
	};

	handleNewInfo(data: any) {
		const { originator, info } = data;
		try {
			if (originator === 'remote') {
				const parsedData = JSON.parse(info.body);
				if (Object.prototype.hasOwnProperty.call(parsedData, '_transcription')) {
					// Emit transcription event and stop here - don't emit newInfo for transcription events
					this.emit('transcription', parsedData._transcription);
					return;
				}
			}
			this.emit('newInfo', data);
		} catch (e) {
			this.emit('newInfo', data);
		}
	}
}
