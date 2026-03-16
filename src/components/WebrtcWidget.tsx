import { useEffect } from "preact/hooks";

import { WebrtcContextProvider } from "./WebrtcContextProvider";
import { DemoPageBackground } from "./DemoPageBackground";
import VoiceBotWidget from "./VoiceBotWidget";
import type { IOptions } from "../types/index.ts";

const App = ({ token, options, mainRef: ref }: { token: string; options: IOptions, mainRef: any }) => {
	useEffect(() => {
		const font = document.createElement("link");
		font.href =
			"https://fonts.googleapis.com/css2?family=Mulish:wght@600&display=swap";
		font.rel = "stylesheet";
		document.body.appendChild(font);
	}, []);

	return (
		<WebrtcContextProvider token={token} options={options}>
			<DemoPageBackground />
			<VoiceBotWidget ref={ref} />
		</WebrtcContextProvider>
	);
};

export default App;
