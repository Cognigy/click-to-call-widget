import type { FC } from "preact/compat";
import { TranscriptDisplay, type TranscriptMessage } from "./TranscriptDisplay";
import type { Theme } from "../constants/themes";

interface TranscriptSectionProps {
	showTranscriptArea: boolean;
	hasCustomBackground: boolean;
	transcriptBgColor: string;
	hasVisibleTranscript: boolean;
	transcriptMessages: TranscriptMessage[];
	theme: Theme;
	agentName?: string;
	isWaitingForTranscript: boolean;
	connectingLabel: string;
}

const TranscriptSection: FC<TranscriptSectionProps> = ({
	showTranscriptArea,
	hasCustomBackground,
	transcriptBgColor,
	hasVisibleTranscript,
	transcriptMessages,
	theme,
	agentName,
	isWaitingForTranscript,
	connectingLabel,
}) => {
	if (!showTranscriptArea) return null;

	return (
		<div
			className={`webrtc_widget_transcript_wrapper ${hasCustomBackground ? 'has-transcript-bg' : ''}`}
			style={hasCustomBackground ? { '--webrtc-transcript-bg-color': transcriptBgColor } as React.CSSProperties : undefined}
		>
			<div className="webrtc_widget_transcript_section">
				{hasVisibleTranscript ? (
				<TranscriptDisplay
					messages={transcriptMessages}
					theme={theme}
					agentName={agentName}
				/>
				) : (
					<div className="webrtc_widget_connecting_message">
						<span className="webrtc_widget_connecting_text">
							{isWaitingForTranscript ? '\u00A0' : connectingLabel}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default TranscriptSection;
