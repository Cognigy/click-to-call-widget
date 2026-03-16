import type { RTCSession } from "jssip/lib/RTCSession";
import type { ThemeName } from "../constants/themes";
import type { TranscriptMessage } from "../components/TranscriptDisplay";

interface ISipConnectivityInfo {
	username: string;
	applicationSid: string;
	password: string;
	wsUri: string;
	realm: string;
}

interface ITranscriptionConfig {
	enabled?: boolean;
	backgroundMode?: 'transparent' | 'custom';
	backgroundColor?: string;
}

interface IDemoPageBackground {
	color?: string;
	mode?: 'color' | 'imageUrl';
	imageUrl?: string;
}

type TWebrtcWidgetPosition = 'centered' | 'bottomRight';

interface IDemoPage {
	background?: IDemoPageBackground;
	position?: TWebrtcWidgetPosition;
}

interface IWebrtcWidgetConfig {
	label?: string;
	tagline?: string;
	active: boolean;
	theme?: ThemeName;
	avatarLogoUrl?: string;
	transcription?: ITranscriptionConfig;
	basePanelBackgroundColor?: string;
	demoPage?: IDemoPage;
}

interface IEndpointSettings {
	snapshotId: string | null;
	endpointUrlToken: string;
	endpointName: string;
	channel: string;
	localeReferenceId: string;
	collectAnalytics: boolean;
	active: boolean;
	version: string;
	sipConnectivityInfo: ISipConnectivityInfo;
	webrtcWidgetConfig: IWebrtcWidgetConfig;
}

interface ISettingsTranscription {
	enabled?: boolean;
}

interface ISettings {
	privacyNotice: IPrivacyNotice;
	transcription?: ISettingsTranscription;
}

interface IPrivacyNotice {
	enabled: boolean;
	text: string;
	cancelButtonText: string;
	submitButtonText: string;
	urlText: string;
	url: string;
}
interface IUi {
	labels: IUiLabels;
}
interface IUiLabels {
	callButton: string;
	endButton: string;
	listenLabel: string;
}
interface IWidgetOverrides {
	theme?: ThemeName;
	avatarLogoUrl?: string;
	tagline?: string;
	transcription?: ITranscriptionConfig;
	basePanelBackgroundColor?: string;
}

interface IOptions {
	userId?: string;
	ui?: IUi;
	widgetOverrides?: IWidgetOverrides;
	demoMode?: boolean;
}
interface IWebrtcContext {
	organisationId: string;
	projectId: string;
	endpointSettings: IEndpointSettings;
	options?: IOptions;
	settings: ISettings;
}
enum ActionTypes {
	SET_DATA = "SET_DATA",
	SET_OPTIONS = "SET_OPTIONS",
	SET_LABELS = "SET_LABELS",
	SET_USER_ID = "SET_USER_ID",
}

export type TExtendedRTCSession = Omit<RTCSession, 'sendInfo'> & {
	_connection: RTCSession["connection"];
	sendInfo: (text: string, data: Record<string, any>) => void;
};

export interface IEndInfo {
	originator: string | null;
	cause: string | null;
	description?: string | null;
}

export interface SessionOptions {
	pcConfig?: RTCConfiguration;
	onSession: (rtcSession: TExtendedRTCSession) => void;
}

export interface CallState {
	isCalling: boolean;
	isCallAnswered: boolean;
	isMuted: boolean;
	sessionStatus: string | undefined;
	transcriptMessages: TranscriptMessage[];
	remoteStream: MediaStream | null;
	localStream: MediaStream | null;
}

export enum CallActionType {
	START_CALL = 'START_CALL',
	CALL_ANSWERED = 'CALL_ANSWERED',
	END_CALL = 'END_CALL',
	SET_MUTED = 'SET_MUTED',
	SET_SESSION_STATUS = 'SET_SESSION_STATUS',
	SET_REMOTE_STREAM = 'SET_REMOTE_STREAM',
	SET_LOCAL_STREAM = 'SET_LOCAL_STREAM',
	SET_STREAMS = 'SET_STREAMS',
	SET_TRANSCRIPT_MESSAGES = 'SET_TRANSCRIPT_MESSAGES',
	UPDATE_TRANSCRIPT_MESSAGES = 'UPDATE_TRANSCRIPT_MESSAGES',
	SYNC_SESSION = 'SYNC_SESSION',
}

export type CallAction =
	| { type: CallActionType.START_CALL }
	| { type: CallActionType.CALL_ANSWERED }
	| { type: CallActionType.END_CALL }
	| { type: CallActionType.SET_MUTED; muted: boolean }
	| { type: CallActionType.SET_SESSION_STATUS; status: string | undefined }
	| { type: CallActionType.SET_REMOTE_STREAM; stream: MediaStream | null }
	| { type: CallActionType.SET_LOCAL_STREAM; stream: MediaStream | null }
	| { type: CallActionType.SET_STREAMS; remote: MediaStream | null; local: MediaStream | null }
	| { type: CallActionType.SET_TRANSCRIPT_MESSAGES; messages: TranscriptMessage[] }
	| { type: CallActionType.UPDATE_TRANSCRIPT_MESSAGES; updater: (prev: TranscriptMessage[]) => TranscriptMessage[] }
	| { type: CallActionType.SYNC_SESSION; status: string | undefined; muted: boolean };

export interface UseDemoCallParams {
	isTranscriptionEnabled: boolean | undefined;
	dispatch: (action: CallAction) => void;
}

export type { IWebrtcContext, ISipConnectivityInfo, IOptions, IWebrtcWidgetConfig, IDemoPageBackground, IDemoPage, TWebrtcWidgetPosition };
export { ActionTypes };
