import type { FC } from "preact/compat";
import styled from "@emotion/styled";

import { useWebrtcContext } from "./WebrtcContextProvider";

interface IProps {
	onClose: () => void;
	onContinue: () => void;
}

const PrivacyDialogContainer = styled.div`
	.privacy-dialog-card {
		background-color: white;
		border-radius: 8px;
		position: fixed;
		bottom: 16px;
		right: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0.1px solid #ebeaea;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
	}

	.privacy-dialog-content-container {
		padding: 24px;
		max-width: 28rem;
		margin: 0 16px;
	}

	.privacy-dialog-text {
		font-size: 14px;
		color: #4B5563;
	}

	.privacy-dialog-url {
		color: #000000;
		text-decoration: underline;
		font-size: 14px;
		cursor: pointer;
	}

	.privacy-dialog-button-container {
		display: flex;
		gap: 12px;
		margin-top: 16px;
	}

	.privacy-dialog-submit-button {
		padding: 8px 16px;
		border-radius: 6px;
		border: 1px solid #D1D5DB;
		background-color: black;
		color: white;
		cursor: pointer;
	}

	.privacy-dialog-cancel-button {
		padding: 8px 16px;
		border: 1px solid #D1D5DB;
		border-radius: 6px;
		cursor: pointer;
	}
`
const PrivacyDialog: FC<IProps> = ({ onClose, onContinue }) => {
	const config = useWebrtcContext();

	return (
		<PrivacyDialogContainer
			data-testid="cognigy-privacy-dialog"
			>
			<div
				className="privacy-dialog-card"
			>
				<div
					className="privacy-dialog-content-container"
					>
					<p
						className="privacy-dialog-text"
					>
						{config?.settings?.privacyNotice?.text ?? ''}
					</p>

					{
						config?.settings?.privacyNotice?.urlText ? (
							<a
								href={config?.settings?.privacyNotice?.url}
								target="_blank"
								rel="noopener noreferrer"
								className="privacy-dialog-url"
							>
								{config?.settings?.privacyNotice?.urlText}
							</a>
						) : null
					}
					<div className="privacy-dialog-button-container">
						<button
							id="cognigy-privacy-submit-button"
							className="privacy-dialog-submit-button"
							onClick={() => {
								onClose();
								onContinue();
							}}
							type="button"
							data-testid="cognigy-privacy-continue"
						>
							{config?.settings?.privacyNotice?.submitButtonText ?? ''}
						</button>
						{
							config?.settings?.privacyNotice?.cancelButtonText ? (
								<button
									id="cognigy-privacy-cancel-button"
									className="privacy-dialog-cancel-button"
									onClick={onClose}
									type="button"
									data-testid="cognigy-privacy-cancel"
								>
									{config?.settings?.privacyNotice?.cancelButtonText ?? ''}
								</button>
							) : null
						}
					</div>

				</div>
			</div>
		</PrivacyDialogContainer>
	)
};

export default PrivacyDialog;
