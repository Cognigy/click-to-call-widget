import { createContext } from "preact";
import { useContext, useEffect, useReducer, useRef } from "preact/hooks";
import type { Dispatch } from "preact/hooks";

import { ActionTypes, type IOptions, type IWebrtcContext } from "../types";
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

			return newState;
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
		case ActionTypes.UPDATE_SETTINGS: {
			const { webrtcWidgetConfig, settings } = action.payload;
			return {
				...state,
				...(settings && {
					settings: {
						...state.settings,
						...settings,
						...(settings.privacyNotice && {
							privacyNotice: {
								...state.settings?.privacyNotice,
								...settings.privacyNotice,
							},
						}),
					},
				}),
				...(webrtcWidgetConfig && {
					endpointSettings: {
						...state.endpointSettings,
						webrtcWidgetConfig: {
							...state.endpointSettings?.webrtcWidgetConfig,
							...webrtcWidgetConfig,
						},
					},
				}),
			};
		}
		default:
			return state;
	}
}

// Create a provider component
export const WebrtcContextProvider = ({
	token: urlWithToken,
	options,
	children,
	onConfigLoaded,
	onConfigError,
}: {
	token: string;
	options?: IOptions;
	children: React.ReactNode;
	/** Called once the endpoint config has been fetched and applied. */
	onConfigLoaded?: () => void;
	/** Called when the endpoint config cannot be fetched (network error or non-2xx). */
	onConfigError?: (error: Error) => void;
}) => {
	const [state, dispatch] = useReducer(webrtcReducer, initialState);

	// Read through refs so the fetch effect below does not re-run (and refetch)
	// when a parent passes new callback identities.
	const onConfigLoadedRef = useRef(onConfigLoaded);
	const onConfigErrorRef = useRef(onConfigError);
	onConfigLoadedRef.current = onConfigLoaded;
	onConfigErrorRef.current = onConfigError;

	useEffect(() => {
		// The config fetch outlives a fast unmount (destroy + re-init, or an
		// embedding page tearing the widget down). Without aborting it, the
		// late `dispatch` lands on a component that is no longer mounted.
		const controller = new AbortController();

		fetch(urlWithToken, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(
						`[WebRTCWidget] failed to fetch the endpoint config: HTTP ${response.status}`
					);
				}
				const data = await response.json();
				if (controller.signal.aborted) return;
				dispatch({
					type: ActionTypes.SET_DATA,
					payload: data,
				});
				onConfigLoadedRef.current?.();
			})
			.catch((e) => {
				// Whatever an aborted request rejects with (AbortError in browsers,
				// something else under some test interceptors), it is not a failure.
				if (controller.signal.aborted) return;
				console.error("Failed to fetch WebRTC config:", e);
				onConfigErrorRef.current?.(e instanceof Error ? e : new Error(String(e)));
			});

		return () => controller.abort();
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
