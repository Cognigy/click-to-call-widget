import styled from "@emotion/styled";
import type { Theme } from "../constants/themes";
import { TRANSCRIPT_AREA_HEIGHT } from "../constants/constants";

export const VoiceBotWidgetContainer = styled.div<{ theme: Theme }>`
	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		font-family: "Mulish", sans-serif;
	}

	.webrtc_widget_outer_wrapper {
		position: fixed;
		bottom: 40px;
		right: 16px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	/*
	 * The transcript panel sits above the pill and the pill stays anchored to
	 * the bottom of the stack.
	 *
	 * This is done with normal flow (flex column, bottom-aligned) rather than
	 * "position: absolute; bottom: 100%" on the transcript. The absolute
	 * version floated the panel upward *out of* the stack, which is invisible
	 * as a problem on a tall page -- there is always room above -- but renders
	 * the transcript entirely outside the visible area in a constrained
	 * container such as an iframe or a sidebar, where there is nothing above
	 * y=0. Because .webrtc_widget_outer_wrapper is fixed to "bottom", letting
	 * the stack grow in flow makes it extend upward anyway, so the appearance
	 * on a normal page is unchanged. (CGY-36067)
	 */
	.webrtc_widget_content_stack {
		position: relative;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.webrtc_widget_transcript_section {
		width: 100%;
		position: relative;
		z-index: 2;
		padding: 16px 12px 0px 12px;
	}

	.webrtc_widget_transcript_wrapper {
		position: relative;
		width: 100%;
		z-index: 2;
	}

	.webrtc_widget_transcript_wrapper.has-transcript-bg {
		background-color: var(--webrtc-transcript-bg-color, transparent);
		border-radius: 12px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
		border: none;
		/*
		 * The panel's lower 80px tucks behind the pill. As an absolute box that
		 * was "bottom: calc(100% - 80px)"; in flow the same overlap is a
		 * negative bottom margin.
		 */
		padding-bottom: 80px;
		margin-bottom: -80px;
	}

	.webrtc_widget_container {
		background-color: var(--webrtc-bg-color, ${(props) => props.theme.backgroundColor});
		border-radius: 999px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
		border: 0.1px solid var(--webrtc-border-color, ${(props) => props.theme.borderColor});
		position: relative;
		z-index: 1;
	}

	.webrtc_widget_container.has-custom-bg {
		box-shadow: none;
		border: none;
		z-index: 3;
	}

	.webrtc_widget_content_container {
		padding: 8px;
		display: flex;
		align-items: center;
		gap: 12px;
		transition: width 0.3s ease-out, height 0.3s ease-out;
	}

	.webrtc_widget_content_container_calling {
		width: 320px;
		height: 80px;
	}

	.webrtc_widget_content_container_idle {
		width: 300px;
		height: 72px;
	}

	.webrtc_widget_content_logo {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.webrtc_widget_content {
		flex: 1;
		font-size: 14px;
		display: flex;
		flex-direction: column;
		gap: 0;
		overflow-x: hidden;
		min-width: 0;
	}

	.webrtc_widget_agent_name {
		color: var(--webrtc-text-color, ${(props) => props.theme.textColor});
		font-weight: 600;
		font-size: 15px;
		line-height: 1.3;
	}

	.webrtc_widget_tagline {
		color: var(--webrtc-text-color, ${(props) => props.theme.textColor});
		opacity: 0.6;
		font-size: 13px;
		line-height: 1.3;
		display: block;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.webrtc_widget_call_duration {
		color: var(--webrtc-text-color, ${(props) => props.theme.textColor});
		opacity: 0.6;
		font-size: 13px;
		line-height: 1.3;
	}

	.webrtc_widget_content_label {
		color: var(--webrtc-text-color, ${(props) => props.theme.textColor});
		padding: 0px 4px;
	}

	.webrtc_widget_call_button {
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		min-width: 56px;
		min-height: 56px;
		max-width: 56px;
		max-height: 56px;
		padding: 0;
		margin: 0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #22c55e;
		border: none;
		color: white;
		cursor: pointer;
		box-sizing: border-box;
		transition: transform 0.15s ease, background-color 0.15s ease;
		will-change: transform;
		&:hover {
			transform: scale(1.05);
			background-color: #16a34a;
		}

		svg {
			width: 24px;
			height: 24px;
		}
	}

	.webrtc_widget_call_actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.webrtc_widget_mute_button {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--webrtc-button-bg, rgba(255, 255, 255, 0.1));
		border: none;
		color: var(--webrtc-text-color, ${(props) => props.theme.textColor});
		cursor: pointer;
		transition: background-color 0.2s ease;

		&:hover {
			background-color: var(--webrtc-button-hover-bg, rgba(255, 255, 255, 0.2));
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		svg {
			width: 24px;
			height: 24px;
		}
	}

	.webrtc_widget_end_call_button {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #ef4444;
		border: none;
		color: white;
		cursor: pointer;
		transition: background-color 0.2s ease;

		&:hover {
			background-color: #dc2626;
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		svg {
			width: 24px;
			height: 24px;
		}
	}

	.webrtc_widget_powered_by {
		font-size: 10px;
		line-height: 120%;
		position: absolute;
		bottom: -18px;
		left: 0;
		width: 100%;
		text-align: center;
		color: var(--webrtc-powered-by-color, ${(props) => props.theme.poweredByColor});
		
		a {
			color: var(--webrtc-powered-by-link-color, ${(props) => props.theme.poweredByLinkColor});
		}
	}

	.webrtc_widget_call_controls_container {
		display: flex;
		gap: 8px;
	}

	.webrtc_widget_content_call_button {
		width: 100%;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		font-size: 0.75rem;
		background: linear-gradient(270deg, var(--webrtc-primary-color, ${(props) => props.theme.primaryColor}), var(--webrtc-secondary-color, ${(props) => props.theme.secondaryColor}));
		border: 1px solid var(--webrtc-secondary-color, ${(props) => props.theme.secondaryColor});
		color: white;
		padding: 0.5rem 0;
		cursor: pointer;
		transition: background 0.3s ease;

		&:hover {
			background: linear-gradient(210deg, var(--webrtc-primary-color, ${(props) => props.theme.primaryColor}), var(--webrtc-secondary-color, ${(props) => props.theme.secondaryColor}));
			border: 1px solid var(--webrtc-secondary-color, ${(props) => props.theme.secondaryColor});
			transition: background 0.3s ease;
		}
	}

	.webrtc_widget_connecting_message {
		width: 100%;
		height: ${TRANSCRIPT_AREA_HEIGHT}px;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.webrtc_widget_connecting_text {
		color: var(--webrtc-text-color, ${(props) => props.theme.textColor});
		opacity: 0.6;
		font-size: 14px;
		text-align: center;
	}
`;
