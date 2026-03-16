import { useState } from "preact/hooks";
import styled from "@emotion/styled";

interface AvatarLogoProps {
	avatarUrl?: string;
	size?: number;
}

const AvatarContainer = styled.div<{ size: number }>`
	width: ${(props) => props.size}px;
	height: ${(props) => props.size}px;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	border-radius: 50%;
	background-color: var(--webrtc-avatar-bg-color, ${(props) => props.theme.avatarBackgroundColor});
`;

const AvatarImage = styled.img<{ size: number }>`
	width: ${(props) => props.size}px;
	height: ${(props) => props.size}px;
	border-radius: 50%;
	object-fit: cover;
`;

export function AvatarLogo({ avatarUrl, size = 56 }: AvatarLogoProps) {
	const [hasError, setHasError] = useState(false);

	const handleImageError = () => {
		setHasError(true);
	};

	if (!avatarUrl || hasError) {
		return (
			<AvatarContainer size={size} className="webrtc_widget_avatar webrtc_widget_avatar_default">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size}>
					<title>AI Agent Avatar</title>
					<circle cx="50" cy="50" r="36" fill="none" stroke="#5B6EE1" strokeWidth="2.5"/>
					
					<g stroke="#5B6EE1" strokeWidth="4.5" strokeLinecap="butt" strokeLinejoin="bevel" fill="none">
						<path d="M 32 62 L 44 38 L 56 62"/>
						<path d="M 68 38 L 68 62"/>
					</g>
				</svg>
			</AvatarContainer>
		);
	}

	return (
		<AvatarContainer size={size} className="webrtc_widget_avatar" role="img" aria-label="AI Agent Avatar">
			<AvatarImage
				src={avatarUrl}
				alt=""
				size={size}
				onError={handleImageError}
			/>
		</AvatarContainer>
	);
}
