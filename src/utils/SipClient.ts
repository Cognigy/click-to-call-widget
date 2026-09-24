import events from "events";
import { type UA as IUA, WebSocketInterface, UA } from "jssip";
import type { UAEventMap } from "jssip/lib/UA";
import { SipSession } from "./SipSession";
import type { TExtendedRTCSession } from "../types";

interface ClientSettings {
	wsUri: string;
	pcConfig?: RTCConfiguration;
}

interface Client {
	fullUsername: string;
	password: string;
	username: string;
	/** Present only for runtime (org/project/endpoint-backed) endpoints — absent
	 *  for legacy ones, which keeps the widget working against old endpoint
	 *  configs without any extra headers being sent. */
	organisationId?: string;
	projectId?: string;
	endpointId?: string;
}

export class SipClient extends events.EventEmitter {
	private _ua: IUA;
	private _pcConfig?: RTCConfiguration;
	private _identityHeaders: string[];

	constructor(client: Client, settings: ClientSettings) {
		super();
		this._pcConfig = settings.pcConfig;
		this._identityHeaders =
			client.organisationId && client.projectId
				? [
						`X-Organisation-Id: ${client.organisationId}`,
						`X-Project-Id: ${client.projectId}`,
						...(client.endpointId ? [`X-Endpoint-Id: ${client.endpointId}`] : []),
					]
				: [];

		console.log({ client, settings }, "creating a sip client");

		const socket = new WebSocketInterface(settings.wsUri);

		// Runtime endpoints have no realm or credentials; the SBC admits them by the
		// declared identity headers only, and nothing needs to reach this UA, so skip
		// REGISTER. The host just has to parse — the resolver ignores it.
		const isRuntime = !!(client.organisationId && client.projectId && client.endpointId);
		const ua = isRuntime
			? {
					uri: `sip:anonymous@${new URL(settings.wsUri).hostname}`,
					sockets: [socket],
					register: false,
				}
			: {
					uri: `sip:${client.fullUsername}`,
					password: client.password,
					authorization_user: client.username,
					sockets: [socket],
					register: true,
				};

		this._ua = new UA(ua);

		["connecting", "connected", "disconnected", "registrationFailed"].forEach((evtName: any) =>
			this._ua.on(evtName as keyof UAEventMap, (data: any) =>
				this.emit(evtName, { ...data, client })
			)
		);
		this._ua.on("registered", (data: any) => {
			console.log("registered", data);
		})
		this._ua.on("newRTCSession", (data: any) => {
			const rtcSession = data.session;
			this._onSession(rtcSession);
		});
	}

	start() {
		console.log("start()");
		this._ua.start();
	}

	stop() {
		console.log("stop()");
		this._ua.stop();
	}

	call(number: string) {
		console.log(`call() [number: ${number}]`);
		this._ua.call(number, {
			//typings are wrong, see node_modules/jssip/lib/RTCSession.js line 285
			//@ts-ignore
			data: {
				originalNumber: number,
			},
			mediaConstraints: { audio: true, video: false },
			pcConfig: this._pcConfig,
			extraHeaders: this._identityHeaders,
		});
	}

	_onSession(rtcSession: TExtendedRTCSession) {
		const session = new SipSession(rtcSession, {
			pcConfig: this._pcConfig,
			onSession: this._onSession.bind(this),
		});
		this.emit("newRTCSession", session);
		this.emit("session", session);
	}
}
