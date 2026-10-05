import { createContext } from "preact";
import { useContext, useEffect, useReducer } from "preact/hooks";
import type { Dispatch } from "preact/hooks";

import { ActionTypes, type IOptions, type IUpdateableSettings, type IWebrtcContext } from "../types";
import { getLocalStore, randomId, setLocalStore } from "../helpers";
import { COGNIGY_WEBRTC_OPTIONS } from "../constants/constants";

// Define the initial state
export const initialState: IWebrtcContext = {
	organisationId: "",
	projectId: "",
	endpointSettings: {
		snapshotId: null,
		endpointUrlToken: "",
		endpointName: "",
		channel: "",
		localeReferenceId: "",
		collectAnalytics: false,
		active: false,
		version: "",
		sipConnectivityInfo: {
			username: "",
			applicationSid: "",
			password: "",
			wsUri: "",
			realm: "",
		},
		webrtcWidgetConfig: {
			label: "",
			active: false,
			transcription: {
				enabled: false,
				backgroundMode: 'transparent',
				backgroundColor: '',
			},
		},
	},
	settings: {
		privacyNotice: {
			enabled: false,
			text: "",
			cancelButtonText: "",
			submitButtonText: "",
			urlText: "",
			url: "",
		},
		transcription: {
			enabled: false,
		},
	},
	options: {
		userId: "",
		ui: {
			labels: {
				callButton: "Start a Call",
				endButton: "End a Call",
				listenLabel: "Listening",
			},
		},
	},
};

// Create the context
export const WebrtcContext = createContext(initialState);
export const WebrtcDispatchContext = createContext<Dispatch<any>>(() => {});
export const useWebrtcDispatch = () => useContext(WebrtcDispatchContext);

function mergeUpdate(target: IUpdateableSettings, update: IUpdateableSettings): IUpdateableSettings {
	const { webrtcWidgetConfig, settings } = update;
	return {
		webrtcWidgetConfig: webrtcWidgetConfig
			? { ...target.webrtcWidgetConfig, ...webrtcWidgetConfig }
			: target.webrtcWidgetConfig,
		settings: settings
			? {
					...target.settings,
					...settings,
					...(settings.privacyNotice && {
						privacyNotice: { ...target.settings?.privacyNotice, ...settings.privacyNotice },
					}),
				}
			: target.settings,
	} as IUpdateableSettings;
}

// Runtime overrides are kept apart from endpointSettings/settings so a config
// load (SET_DATA) cannot wipe an updateSettings() that arrived before it.
function withOverrides(state: any) {
	if (!state.overrides) return state;
	const merged = mergeUpdate(
		{ webrtcWidgetConfig: state.endpointSettings?.webrtcWidgetConfig, settings: state.settings },
		state.overrides,
	);
	return {
		...state,
		settings: merged.settings,
		endpointSettings: { ...state.endpointSettings, webrtcWidgetConfig: merged.webrtcWidgetConfig },
	};
}

// Define the reducer function
export function webrtcReducer(state: any, action: any) {
	switch (action.type) {
		case ActionTypes.SET_DATA: {
			const newState = {
				...state,
				...action.payload,
				options: {
					...state.options,
					...action.payload.options,
				}
			};

			if (!newState.options?.userId) {
				const originalEndpointName = newState.endpointSettings?.endpointName || "";
				const endpointName = originalEndpointName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'endpoint';
				const existingUserOptions = getLocalStore(COGNIGY_WEBRTC_OPTIONS) || {};
				const userId = existingUserOptions.userId || `webrtc-${endpointName}-${randomId()}`;
				setLocalStore(COGNIGY_WEBRTC_OPTIONS, { ...existingUserOptions, userId });
				newState.options = { ...newState.options, userId };
			}

			return withOverrides(newState);
		}
		case ActionTypes.UPDATE_SETTINGS: {
			// `active` is excluded from IUpdateableSettings, but JS callers bypass
			// TypeScript entirely, so strip it here too rather than trust the type alone.
			const { active: _active, ...safeWebrtcWidgetConfig } = action.payload?.webrtcWidgetConfig ?? {};
			const update: IUpdateableSettings = {
				...(action.payload?.webrtcWidgetConfig && { webrtcWidgetConfig: safeWebrtcWidgetConfig }),
				...(action.payload?.settings && { settings: action.payload.settings }),
			};
			return withOverrides({ ...state, overrides: mergeUpdate(state.overrides ?? {}, update) });
		}
		case ActionTypes.SET_OPTIONS: {
			const newOptions = {
				...state.options,
				...action.payload,
				ui: {
					...state.options.ui,
					...action.payload.ui,
					labels: {
						...state.options.ui?.labels,
						...action.payload.ui?.labels,
					}
				},
				widgetOverrides: {
					...state.options.widgetOverrides,
					...action.payload.widgetOverrides,
				}
			};
			if (action.payload.demoMode !== undefined) {
				newOptions.demoMode = action.payload.demoMode;
			}
			const newState = {
				...state,
				options: newOptions,
			};
			return newState;
		}

		case ActionTypes.SET_USER_ID:
			return {
				...state,
				options: { ...state.options, userId: action.payload },
			};
		case ActionTypes.SET_LABELS:
			return {
				...state,
				options: {
					...state.options,
					ui: { ...state.options.ui, labels: {
						...state.options.ui.labels,
						...action.payload
					} },
				},
			};
		default:
			return state;
	}
}

// Create a provider component
export const WebrtcContextProvider = ({
	token: urlWithToken,
	options,
	children,
}: {
	token: string;
	options?: IOptions;
	children: React.ReactNode;
}) => {
	const [state, dispatch] = useReducer(webrtcReducer, initialState);

	useEffect(() => {
		fetch(urlWithToken)
			.then(async (response) => {
				const data = await response.json();
				dispatch({
					type: ActionTypes.SET_DATA,
					payload: data,
				});
			})
			.catch((e) => {
				console.error("Failed to fetch WebRTC config:", e);
			});
	}, [urlWithToken]);

	useEffect(() => {
		if(options) {
			dispatch({
				type: ActionTypes.SET_OPTIONS,
				payload: options,
			});
		}
	}, [options]);

	return (
		<WebrtcContext.Provider value={state}>
			<WebrtcDispatchContext.Provider value={dispatch}>
				{children}
			</WebrtcDispatchContext.Provider>
		</WebrtcContext.Provider>
	);
};

// Custom hook to use the context
export const useWebrtcContext = () => useContext(WebrtcContext);
