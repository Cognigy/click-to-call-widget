import type { WebRTCClient } from "@cognigy/click-to-call-sdk";
import type { ThemeName } from "../constants/themes";

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
	/** Absent from older endpoint configs. */
	endpointId?: string;
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
	/** @deprecated ignored */
	demoMode?: boolean;
}
interface IWebrtcContext {
	client: WebRTCClient | null;
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

export type { IWebrtcContext, ISipConnectivityInfo, IOptions, IWebrtcWidgetConfig, IDemoPageBackground, IDemoPage, TWebrtcWidgetPosition };
export { ActionTypes };
