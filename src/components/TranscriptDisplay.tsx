import { useEffect, useRef } from "preact/hooks";
import styled from "@emotion/styled";
import type { Theme } from "../constants/themes";
import { TRANSCRIPT_AREA_HEIGHT } from "../constants/constants";

export interface TranscriptMessage {
	id: string;
	text: string;
	originator: 'bot' | 'user';
	timestamp: number;
}

interface TranscriptDisplayProps {
	messages: TranscriptMessage[];
	theme: Theme;
	maxMessages?: number;
	agentName?: string;
}

const FADE_HEIGHT = 40;

const TranscriptContainer = styled.div`
	position: relative;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	gap: 10px;
	padding: 0 0 12px 0;
	height: ${TRANSCRIPT_AREA_HEIGHT}px;
	overflow-y: auto;
	overflow-x: hidden;

	mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		black ${FADE_HEIGHT}px,
		black 100%
	);
	-webkit-mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		black ${FADE_HEIGHT}px,
		black 100%
	);

	scrollbar-width: none;
	-ms-overflow-style: none;

	&::-webkit-scrollbar {
		display: none;
	}
`;

const MessageWrapper = styled.div<{ originator: 'bot' | 'user' }>`
	display: flex;
	flex-direction: column;
	gap: 4px;
	align-items: ${(props) => props.originator === 'bot' ? 'flex-start' : 'flex-end'};
	animation: fadeInUp 0.25s ease-out;

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
`;

const AgentNameLabel = styled.span<{ primaryColor: string }>`
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--webrtc-primary-color, ${(props) => props.primaryColor});
	padding-left: 4px;
`;

const MessageBubble = styled.div<{
	originator: 'bot' | 'user';
	botBg: string;
	userBg: string;
	botText: string;
	userText: string;
}>`
	padding: 10px 14px;
	border-radius: 16px;
	font-size: 13px;
	line-height: 1.4;
	max-width: 90%;
	word-wrap: break-word;
	overflow-wrap: break-word;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

	${(props) =>
		props.originator === 'bot'
			? `
				background-color: var(--webrtc-bubble-bot-bg, ${props.botBg});
				color: var(--webrtc-bubble-bot-text, ${props.botText});
				border-bottom-left-radius: 4px;
			`
			: `
				background-color: var(--webrtc-bubble-user-bg, ${props.userBg});
				color: var(--webrtc-bubble-user-text, ${props.userText});
				border-bottom-right-radius: 4px;
			`}
`;

export function TranscriptDisplay({
	messages,
	theme,
	maxMessages = 3,
	agentName,
}: TranscriptDisplayProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	const visibleMessages = messages.slice(-maxMessages);

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, [messages]);

	if (visibleMessages.length === 0) {
		return null;
	}

	return (
		<TranscriptContainer
			ref={containerRef}
			className="webrtc_transcript_container"
		>
			{visibleMessages.map((message, index) => {
				const prevMessage = index > 0 ? visibleMessages[index - 1] : null;
				const showAgentName = message.originator === 'bot' && 
					agentName && 
					(!prevMessage || prevMessage.originator !== 'bot');

				return (
					<MessageWrapper
						key={message.id}
						originator={message.originator}
						className={`webrtc_transcript_message webrtc_transcript_message_${message.originator}`}
					>
						{showAgentName && (
							<AgentNameLabel 
								primaryColor={theme.primaryColor}
								className="webrtc_transcript_agent_name"
							>
								{agentName}
							</AgentNameLabel>
						)}
						<MessageBubble
							originator={message.originator}
							botBg={theme.bubbleBotBg}
							userBg={theme.bubbleUserBg}
							botText={theme.bubbleBotText}
							userText={theme.bubbleUserText}
							className={`webrtc_transcript_bubble webrtc_transcript_bubble_${message.originator}`}
						>
							{message.text}
						</MessageBubble>
					</MessageWrapper>
				);
			})}
		</TranscriptContainer>
	);
}
