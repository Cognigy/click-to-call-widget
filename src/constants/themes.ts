export type ThemeName = 'DARK_MODE' | 'AI_PURPLE' | 'CLEAN_WHITE';

export interface Theme {
	name: ThemeName;
	backgroundColor: string;
	textColor: string;
	primaryColor: string;
	secondaryColor: string;
	borderColor: string;
	bubbleBotBg: string;
	bubbleUserBg: string;
	bubbleBotText: string;
	bubbleUserText: string;
	poweredByColor: string;
	poweredByLinkColor: string;
	avatarBackgroundColor: string;
}

export const themes: Record<ThemeName, Theme> = {
	CLEAN_WHITE: {
		name: 'CLEAN_WHITE',
		backgroundColor: 'rgba(255, 255, 255, 1)',
		textColor: 'rgba(31, 41, 55, 1)',
		primaryColor: 'rgba(37, 99, 235, 1)',
		secondaryColor: 'rgba(30, 64, 175, 1)',
		borderColor: 'rgba(235, 234, 234, 1)',
		bubbleBotBg: 'rgba(243, 244, 246, 1)',
		bubbleUserBg: 'rgba(37, 99, 235, 1)',
		bubbleBotText: 'rgba(31, 41, 55, 1)',
		bubbleUserText: 'rgba(255, 255, 255, 1)',
		poweredByColor: 'rgba(255, 255, 255, 0.4)',
		poweredByLinkColor: 'rgba(255, 255, 255, 0.5)',
		avatarBackgroundColor: 'rgba(243, 244, 246, 1)',
	},
	DARK_MODE: {
		name: 'DARK_MODE',
		backgroundColor: 'rgba(2, 8, 23, 1)',
		textColor: 'rgba(255, 255, 255, 1)',
		primaryColor: 'rgba(59, 130, 246, 1)',
		secondaryColor: 'rgba(37, 99, 235, 1)',
		borderColor: 'rgba(45, 45, 68, 1)',
		bubbleBotBg: 'rgba(55, 65, 81, 1)',
		bubbleUserBg: 'rgba(59, 130, 246, 1)',
		bubbleBotText: 'rgba(255, 255, 255, 1)',
		bubbleUserText: 'rgba(255, 255, 255, 1)',
		poweredByColor: 'rgba(2, 8, 23, 0.4)',
		poweredByLinkColor: 'rgba(2, 8, 23, 0.5)',
		avatarBackgroundColor: 'rgba(30, 30, 30, 1)',
	},
	AI_PURPLE: {
		name: 'AI_PURPLE',
		backgroundColor: 'rgba(43, 5, 90, 1)',
		textColor: 'rgba(255, 255, 255, 1)',
		primaryColor: 'rgba(139, 92, 246, 1)',
		secondaryColor: 'rgba(124, 58, 237, 1)',
		borderColor: 'rgba(76, 29, 149, 1)',
		bubbleBotBg: 'rgba(76, 29, 149, 1)',
		bubbleUserBg: 'rgba(139, 92, 246, 1)',
		bubbleBotText: 'rgba(255, 255, 255, 1)',
		bubbleUserText: 'rgba(255, 255, 255, 1)',
		poweredByColor: 'rgba(43, 5, 90, 0.4)',
		poweredByLinkColor: 'rgba(43, 5, 90, 0.5)',
		avatarBackgroundColor: 'rgba(61, 13, 122, 1)',
	},
};

export const DEFAULT_THEME: ThemeName = 'DARK_MODE';

export function getTheme(themeName?: ThemeName): Theme {
	return themes[themeName || DEFAULT_THEME];
}

export function getThemeCSSVariables(theme: Theme): Record<string, string> {
	return {
		'--webrtc-bg-color': theme.backgroundColor,
		'--webrtc-text-color': theme.textColor,
		'--webrtc-primary-color': theme.primaryColor,
		'--webrtc-secondary-color': theme.secondaryColor,
		'--webrtc-border-color': theme.borderColor,
		'--webrtc-bubble-bot-bg': theme.bubbleBotBg,
		'--webrtc-bubble-user-bg': theme.bubbleUserBg,
		'--webrtc-bubble-bot-text': theme.bubbleBotText,
		'--webrtc-bubble-user-text': theme.bubbleUserText,
		'--webrtc-powered-by-color': theme.poweredByColor,
		'--webrtc-powered-by-link-color': theme.poweredByLinkColor,
		'--webrtc-avatar-bg-color': theme.avatarBackgroundColor,
	};
}
