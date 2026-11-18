# Click to Call Widget

A customizable WebRTC-based Click to Call Widget built with Preact on top of the [`@cognigy/click-to-call-sdk`](https://github.com/Cognigy/click-to-call-sdk) for integrating voice capabilities into web applications. This widget specifically enables communication with Cognigy AI voicebots.

## Features

- Real-time voice communication using WebRTC, built on the Cognigy click-to-call SDK (`@cognigy/click-to-call-sdk`), which owns signaling and call state
- Works with legacy and runtime endpoints
- Seamless integration with Cognigy.AI voicebots
- Privacy-first approach with user consent management
- Customizable UI with animated components
- Mute/unmute functionality
- Call controls
- Responsive design

## Technology Stack

- Preact
- TypeScript
- Vite
- `@cognigy/click-to-call-sdk` (WebRTC signaling, configuration and call state)
- Material-UI components

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the mock configuration template and fill in your credentials:
   ```bash
   cp src/mocks/mock.example.json src/mocks/mock.json
   ```
   Then edit `src/mocks/mock.json` with your credentials (for development purposes).

## Development

To start the development server:

```bash
npm run dev
```

The development server will start on port 3000 by default.

## Building

To build the project:

```bash
npm run build
```

This will create a production-ready build in the `dist` directory. The widget is built as a CommonJS module that can be integrated into other applications.

## Releases

Merges to `main` replace pending versioned drafts and their tags with one draft
containing all releasable changes since the last published release. Notes and
bundle assets are regenerated, replacing any manual edits to pending drafts.
Publish the draft manually when ready; published releases are left untouched.

## Usage

The widget can be integrated into any web application. After building, include the generated JavaScript file and initialize the widget.

### Privacy Management

The widget implements a privacy-first approach with a consent dialog that appears before initiating calls. User consent is stored in localStorage for future sessions.

### Animated Interface

Features an animated blob component that provides visual feedback during calls.

### Call Controls

Provides essential call controls including:

- Start/End call
- Mute/Unmute
- Call status indicators

### Events

`initWebRTCWidget(token, options, callback)` resolves to the widget instance (and passes it to the optional callback). It has two methods: `on(event, handler)` and `updateSettings()` (see below).

`on` subscribes to the events of the [`@cognigy/click-to-call-sdk`](https://github.com/Cognigy/click-to-call-sdk) client, using the SDK's event names and payloads:

| Event | Handler arguments |
| --- | --- |
| `connecting`, `connected` | `{}` |
| `disconnected` | `{ code, reason }` |
| `sessionCreated`, `ringing`, `answered`, `muted`, `unmuted` | `session` (`{ id, status, direction, startTime, answerTime, duration, muted, localHold, remoteHold }`) |
| `ended`, `failed` | `session`, `{ originator, cause, description }` |
| `infoReceived` | `{ originator, info }` (transcription messages are not included) |
| `transcription` | the transcription payload, e.g. `{ originator, messages: [{ text }] }` |
| `error` | `Error` |

```javascript
window.initWebRTCWidget(token, { userId: 'user123' }).then((widget) => {
  widget.on('sessionCreated', (session) => console.log('Call started', session.id));
  widget.on('answered', () => console.log('Call answered'));
  widget.on('transcription', ({ originator, messages }) => {
    messages.forEach((message) => console.log(originator, message.text));
  });
  widget.on('ended', (session, { originator, cause }) => console.log('Call ended', originator, cause));
  widget.on('disconnected', ({ code, reason }) => console.log('Disconnected:', code, reason));
});
```

The same works with the callback: `window.initWebRTCWidget(token, {}, (widget) => widget.on(...))`.

For anything beyond listening, such as sending info messages or controlling calls programmatically, use the SDK directly.

#### Differences from the previous implementation

- **Removed:** `widget.on('newRTCSession', ...)` and `widget.on('session', ...)`, the session objects they delivered (`session.on(...)`, `sendInfo`, `terminate`, `mute`, `unmute`, `sendDtmf`, `jssipRtcSession`, `direction`, `duration`, `hold`/`unhold` and so on), and the events only those sessions emitted (`newInfo`, `terminated`, `accepted`, `change`, `peerconnection`). Subscribing to `newRTCSession` logs a warning and never fires. Use `sessionCreated` and the other SDK events instead.
- `connecting`, `connected` and `disconnected` payloads no longer carry `client` or `socket`; `disconnected` carries `{ code, reason }`.
- `disconnected` fires after every call, including a remote hangup, because the widget disconnects after each call.
- `registered`, `unregistered` and `registrationFailed` never fire: the widget does not send REGISTER.
- With call transfers (REFER/replaces), the replaced session no longer gets an `ended` event.
- A transport drop during an established call ends the call (previously the media continued while the WebSocket reconnected).
- The mute button is disabled until the call is answered.
- `initWebRTCWidget` resolves before the config has loaded, when the widget is inactive, and when the config fetch fails.

### Updating Settings at Runtime

The widget instance exposes an `updateSettings` method that lets you change the widget's appearance and behaviour after initialization, without re-initializing it. This is useful for live previews or reacting to user actions.

```javascript
window.initWebRTCWidget(token, options).then((widget) => {
  widget.updateSettings({
    webrtcWidgetConfig: {
      label: "Support",
      tagline: "We're here to help",
      theme: "AI_PURPLE",
      transcription: { enabled: true, backgroundMode: "transparent" },
      demoPage: {
        position: "centered",
        background: { mode: "color", color: "#FFFFFF" },
      },
    },
    settings: {
      transcription: { enabled: true },
      privacyNotice: { text: "Updated privacy notice" },
    },
  });
});
```

#### Accepted Fields

`updateSettings(settings)` accepts an object with two optional top-level keys:

- **`webrtcWidgetConfig`** — widget appearance and config. Supported fields: `label`, `tagline`, `theme`, `avatarLogoUrl`, `transcription`, `basePanelBackgroundColor`, `demoPage`. The `active` flag is intentionally **not** updateable.
- **`settings`** — runtime settings. Supported fields: `privacyNotice` and `transcription`.

#### Merge Behaviour

- Only the keys you provide are changed; everything else is left untouched.
- `webrtcWidgetConfig` and top-level `settings` keys are shallow-merged into the existing state.
- `settings.privacyNotice` is deep-merged, so you can update a single field (e.g. just `text`) without resetting the rest of the privacy notice.
- Any other fields (such as `userId` or `demoMode`) are ignored — `updateSettings` only affects `webrtcWidgetConfig` and `settings`.
- Calling it before the endpoint config has loaded is safe: the update is kept apart from the loaded config and re-applied once it arrives.


### UI Customization

The widget allows customization of UI labels through the initialization options. You can override the default labels by passing a `ui` object in the options:

```javascript
window.initWebRTCWidget(token, {
  userId: 'user123',  // Optional: User ID for the call
  ui: {
    labels: {
      callButton: "Start Voice Chat",    // Custom call button text
      endButton: "Hang Up",             // Custom end call button text
      listenLabel: "Voice Bot Active"    // Custom listening status text
    }
  }
});
```

If not specified, the default labels are:
- Call Button: "Start a Call"
- End Button: "End a Call"
- Listen Label: "Listening"

## Customizing Widget Styles

You can easily override the default styles of the Click to Call Widget by targeting its CSS class names in your own stylesheet. This allows you to adapt the widget's appearance to match your application's branding and user experience.

### Theme Colors

The widget ships with three built-in themes. The default theme is `DARK_MODE`. All color values are in RGBA format.

#### CLEAN_WHITE

| Property                | Value                        |
|-------------------------|------------------------------|
| `backgroundColor`       | `rgba(255, 255, 255, 1)`    |
| `textColor`             | `rgba(31, 41, 55, 1)`       |
| `primaryColor`          | `rgba(37, 99, 235, 1)`      |
| `secondaryColor`        | `rgba(30, 64, 175, 1)`      |
| `borderColor`           | `rgba(235, 234, 234, 1)`    |
| `bubbleBotBg`           | `rgba(243, 244, 246, 1)`    |
| `bubbleUserBg`          | `rgba(37, 99, 235, 1)`      |
| `bubbleBotText`         | `rgba(31, 41, 55, 1)`       |
| `bubbleUserText`        | `rgba(255, 255, 255, 1)`    |
| `poweredByColor`        | `rgba(255, 255, 255, 0.4)`  |
| `poweredByLinkColor`    | `rgba(255, 255, 255, 0.5)`  |
| `avatarBackgroundColor` | `rgba(243, 244, 246, 1)`    |

#### DARK_MODE (default)

| Property                | Value                        |
|-------------------------|------------------------------|
| `backgroundColor`       | `rgba(2, 8, 23, 1)`         |
| `textColor`             | `rgba(255, 255, 255, 1)`    |
| `primaryColor`          | `rgba(59, 130, 246, 1)`     |
| `secondaryColor`        | `rgba(37, 99, 235, 1)`      |
| `borderColor`           | `rgba(45, 45, 68, 1)`       |
| `bubbleBotBg`           | `rgba(55, 65, 81, 1)`       |
| `bubbleUserBg`          | `rgba(59, 130, 246, 1)`     |
| `bubbleBotText`         | `rgba(255, 255, 255, 1)`    |
| `bubbleUserText`        | `rgba(255, 255, 255, 1)`    |
| `poweredByColor`        | `rgba(2, 8, 23, 0.4)`       |
| `poweredByLinkColor`    | `rgba(2, 8, 23, 0.5)`       |
| `avatarBackgroundColor` | `rgba(30, 30, 30, 1)`       |

#### AI_PURPLE

| Property                | Value                        |
|-------------------------|------------------------------|
| `backgroundColor`       | `rgba(43, 5, 90, 1)`        |
| `textColor`             | `rgba(255, 255, 255, 1)`    |
| `primaryColor`          | `rgba(139, 92, 246, 1)`     |
| `secondaryColor`        | `rgba(124, 58, 237, 1)`     |
| `borderColor`           | `rgba(76, 29, 149, 1)`      |
| `bubbleBotBg`           | `rgba(76, 29, 149, 1)`      |
| `bubbleUserBg`          | `rgba(139, 92, 246, 1)`     |
| `bubbleBotText`         | `rgba(255, 255, 255, 1)`    |
| `bubbleUserText`        | `rgba(255, 255, 255, 1)`    |
| `poweredByColor`        | `rgba(43, 5, 90, 0.4)`      |
| `poweredByLinkColor`    | `rgba(43, 5, 90, 0.5)`      |
| `avatarBackgroundColor` | `rgba(61, 13, 122, 1)`      |

Each theme property maps to a CSS custom property that you can also override directly:

| Theme Property          | CSS Variable                     |
|-------------------------|----------------------------------|
| `backgroundColor`       | `--webrtc-bg-color`              |
| `textColor`             | `--webrtc-text-color`            |
| `primaryColor`          | `--webrtc-primary-color`         |
| `secondaryColor`        | `--webrtc-secondary-color`       |
| `borderColor`           | `--webrtc-border-color`          |
| `bubbleBotBg`           | `--webrtc-bubble-bot-bg`         |
| `bubbleUserBg`          | `--webrtc-bubble-user-bg`        |
| `bubbleBotText`         | `--webrtc-bubble-bot-text`       |
| `bubbleUserText`        | `--webrtc-bubble-user-text`      |
| `poweredByColor`        | `--webrtc-powered-by-color`      |
| `poweredByLinkColor`    | `--webrtc-powered-by-link-color` |
| `avatarBackgroundColor` | `--webrtc-avatar-bg-color`       |

### How to Override Styles

Simply add CSS rules to your global stylesheet or inject custom styles that target the class names listed below. For example:

```css
.webrtc_widget_container {
  background: rgba(34, 34, 34, 1);
  color: rgba(255, 255, 255, 1);
}
```

### List of Overrideable CSS Classes

**VoiceBotWidget (main container)**
- `webrtc_widget_outer_wrapper`
- `webrtc_widget_content_stack`
- `webrtc_widget_container` (modifier: `has-custom-bg`)
- `webrtc_widget_content_container`
- `webrtc_widget_content_container_calling`
- `webrtc_widget_content_container_idle`
- `webrtc_widget_content_logo`
- `webrtc_widget_content`
- `webrtc_widget_agent_name`
- `webrtc_widget_tagline`
- `webrtc_widget_call_duration`
- `webrtc_widget_content_label`
- `webrtc_widget_powered_by`
- `webrtc_widget_connecting_message`
- `webrtc_widget_connecting_text`

**Call Controls**
- `webrtc_widget_call_button`
- `webrtc_widget_call_actions`
- `webrtc_widget_mute_button`
- `webrtc_widget_end_call_button`
- `webrtc_widget_call_controls_container`
- `webrtc_widget_content_call_button`

**Transcript**
- `webrtc_widget_transcript_section`
- `webrtc_widget_transcript_wrapper` (modifier: `has-transcript-bg`)
- `webrtc_transcript_container`
- `webrtc_transcript_message`
- `webrtc_transcript_message_bot`
- `webrtc_transcript_message_user`
- `webrtc_transcript_agent_name`
- `webrtc_transcript_bubble`
- `webrtc_transcript_bubble_bot`
- `webrtc_transcript_bubble_user`

**Avatar**
- `webrtc_widget_avatar`
- `webrtc_widget_avatar_default`

**Audio Wave**
- `webrtc_widget_audio_wave`

**Privacy Dialog**
- `privacy-dialog-card`
- `privacy-dialog-content-container`
- `privacy-dialog-text`
- `privacy-dialog-url`
- `privacy-dialog-button-container`
- `privacy-dialog-submit-button`
- `privacy-dialog-cancel-button`

**Tip:**
If you need to apply styles with higher specificity, consider using `!important` or more specific selectors.

## License

MIT

## Acknowledgments

- Built with Preact
- Uses `@cognigy/click-to-call-sdk` for WebRTC signaling
- Powered by Cognigy.AI
