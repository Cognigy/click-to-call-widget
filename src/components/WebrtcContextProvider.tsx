import { createContext } from "preact";
import { useContext, useEffect, useMemo, useReducer } from "preact/hooks";

import { ActionTypes, type IOptions, type IWebrtcContext } from "../types";
import { useWebRTCClient } from "../hooks/useWebRTCClient";

// Define the initial state
const initialState: IWebrtcContext = {
	client: null,
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

// Define the reducer function
function webrtcReducer(state: any, action: any) {
	switch (action.type) {
		case ActionTypes.SET_DATA: {
			return {
				...state,
				...action.payload,
				options: {
					...state.options,
					...action.payload.options,
				},
			};
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

	const { client, config, userId } = useWebRTCClient(
		urlWithToken,
		options?.userId
	);

	useEffect(() => {
		if (!config) return;
		dispatch({
			type: ActionTypes.SET_DATA,
			// The SDK's EndpointConfig is structurally the widget's config payload.
			payload: { ...(config as unknown as Partial<IWebrtcContext>), options: { userId } },
		});
	}, [config, userId]);

	useEffect(() => {
		if(options) {
			dispatch({
				type: ActionTypes.SET_OPTIONS,
				payload: options,
			});
		}
	}, [options]);

	const value = useMemo(() => ({ ...state, client }), [state, client]);

	return (
		<WebrtcContext.Provider value={value}>{children}</WebrtcContext.Provider>
	);
};

// Custom hook to use the context
export const useWebrtcContext = () => useContext(WebrtcContext);
