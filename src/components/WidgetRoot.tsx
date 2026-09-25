import { useCallback, useRef } from "preact/hooks";

import { WebrtcContextProvider } from "./WebrtcContextProvider";
import { DemoPageBackground } from "./DemoPageBackground";
import VoiceBotWidget from "./VoiceBotWidget";
import type { IOptions, IWidgetInstance } from "../types/index.ts";

export interface WidgetRootProps {
	token: string;
	options: IOptions;
	/**
	 * Receives the widget instance once the widget is actually usable: the
	 * imperative handle exists AND the endpoint config has been applied.
	 */
	mainRef: (instance: IWidgetInstance | null) => void;
	/** Receives the error when the endpoint config cannot be loaded. */
	onError?: (error: Error) => void;
}

/**
 * The widget tree without the Emotion `CacheProvider` (see `WebrtcWidget.tsx`),
 * so its readiness contract can be tested under vitest.
 *
 * `useImperativeHandle` hands out the instance on the very first render, long
 * before the endpoint config arrives. Reporting it then would let the embedder
 * call `updateSettings()` into state that `SET_DATA` is about to replace, so
 * `mainRef` is held back until the config has loaded (CGY-36067).
 */
export const WidgetRoot = ({ token, options, mainRef, onError }: WidgetRootProps) => {
	const instanceRef = useRef<IWidgetInstance | null>(null);
	const configLoadedRef = useRef(false);
	const mainRefRef = useRef(mainRef);
	mainRefRef.current = mainRef;

	const reportIfReady = useCallback(() => {
		if (instanceRef.current && configLoadedRef.current) {
			mainRefRef.current(instanceRef.current);
		}
	}, []);

	const handleRef = useCallback(
		(instance: IWidgetInstance | null) => {
			instanceRef.current = instance;
			reportIfReady();
		},
		[reportIfReady]
	);

	const handleConfigLoaded = useCallback(() => {
		configLoadedRef.current = true;
		reportIfReady();
	}, [reportIfReady]);

	return (
		<WebrtcContextProvider
			token={token}
			options={options}
			onConfigLoaded={handleConfigLoaded}
			onConfigError={onError}
		>
			<DemoPageBackground />
			<VoiceBotWidget ref={handleRef} />
		</WebrtcContextProvider>
	);
};
