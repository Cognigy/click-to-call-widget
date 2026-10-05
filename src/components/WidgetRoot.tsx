import { useCallback, useRef } from "preact/hooks";

import { WebrtcContextProvider } from "./WebrtcContextProvider";
import { DemoPageBackground } from "./DemoPageBackground";
import VoiceBotWidget from "./VoiceBotWidget";
import type { IOptions, IWidgetInstance } from "../types/index.ts";

export interface WidgetRootProps {
	token: string;
	options: IOptions;
	/** Fires once usable: imperative handle exists AND endpoint config applied. */
	mainRef: (instance: IWidgetInstance | null) => void;
	/** Receives the error when the endpoint config cannot be loaded. */
	onError?: (error: Error) => void;
}

// Excludes Emotion's CacheProvider (see WebrtcWidget.tsx) so this tree is testable under vitest.
// mainRef is held back until config loads: reporting earlier would let the embedder call updateSettings()
// into state that SET_DATA is about to replace (CGY-36067).
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
