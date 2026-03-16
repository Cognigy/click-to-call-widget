import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import PhoneDisabledIcon from "@mui/icons-material/PhoneDisabled";
import PhoneIcon from "@mui/icons-material/Phone";

import type { FC } from "preact/compat";

interface IProps {
	onMuteToggle: () => void;
	onEndCall: () => void;
	isMuted: boolean;
	isCalling: boolean;
	handleStartCall: () => void;
	disabled?: boolean;
	status?: string;
}

const CallControls: FC<IProps> = ({
	onMuteToggle,
	isMuted,
	onEndCall,
	isCalling,
	handleStartCall,
	disabled = false,
}) => {
	if (isCalling) {
		return (
			<div className="webrtc_widget_call_actions" data-testid="cognigy-call-controls">
				<button
					type="button"
					className="webrtc_widget_mute_button"
					onClick={onMuteToggle}
					disabled={disabled}
					aria-label={isMuted ? "Unmute" : "Mute"}
					data-testid="cognigy-mute-unmute-button"
				>
					{isMuted ? <MicOffIcon /> : <MicIcon />}
				</button>
				<button
					type="button"
					className="webrtc_widget_end_call_button"
					onClick={onEndCall}
					disabled={disabled}
					aria-label="End call"
					data-testid="cognigy-end-call-button"
				>
					<PhoneDisabledIcon style={{ transform: "scaleX(-1)" }} />
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			className="webrtc_widget_call_button"
			onClick={handleStartCall}
			aria-label="Start a call"
			data-testid="cognigy-call-button"
		>
			<PhoneIcon />
		</button>
	);
};

export default CallControls;
