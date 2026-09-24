# Click to Call Widget

A customizable WebRTC-based Click to Call Widget built with Preact and JsSIP for integrating voice capabilities into web applications. This widget specifically enables communication with Cognigy AI voicebots.

## Features

- Real-time voice communication using WebRTC
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
- JsSIP (WebRTC signaling)
- Socket.IO
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
   Then edit `src/mocks/mock.json` with your SIP credentials (for development purposes).

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

### Event Handling and Callbacks

The widget provides a comprehensive event system for handling WebRTC sessions and user interactions. You can attach event listeners and callbacks in two ways:

#### 1. Using Event Listeners

```javascript
// Initialize the widget
window.initWebRTCWidget(token, { userId: 'user123' }).then((widget) => {
  // Listen for new RTC sessions
  widget.on('newRTCSession', (session) => {
    console.log('New RTC session created:', session);



    // Listen for answered events
    session.on('answered', () => {
      console.log('Session answered');
    });

    // Listen for new info events on the session
    session.on('newInfo', (infoEvent) => {
      console.log('New info received:', infoEvent);
    });

    // Listen for transcription events
    session.on('transcription', (transcription) => {
      console.log('Transcription received:', transcription);
    });

    // Listen for session state changes
    session.on('failed', () => {
      console.log('Session failed');
    });

    session.on('ended', () => {
      console.log('Session ended');
    });

    session.on('terminated', () => {
      console.log('Session terminated');
    });
  });

  // Listen for user agent events
  widget.on('change', () => {
    console.log('User agent state changed');
  });

  widget.on('answer', () => {
    console.log('Call answered');
  });

  widget.on('disconnected', ({ socket }) => {
    console.log('Disconnected:', socket);
  });

  widget.on('registrationFailed', ({ response, client }) => {
    console.log('Registration failed:', response.status_code);
  });
});
```

#### 2. Using Callback Options

You can also pass callbacks through the initialization options:

```javascript

window.initWebRTCWidget(token, {},(widget) => {
  // Listen for new RTC sessions
  widget.on('newRTCSession', (session) => {
    console.log('New RTC session created:', session);

    // Listen for new info events on the session
    session.on('newInfo', (infoEvent) => {
      console.log('New info received:', infoEvent);
	});
  });
});
```

#### Available Events

##### User Agent Events
- `newRTCSession`: Triggered when a new RTC session is created
- `connecting`: Triggered when the connection is being established
- `connected`: Triggered when the connection is successfully established
- `disconnected`: Triggered when the connection is disconnected
- `registrationFailed`: Triggered when registration fails

##### Session Events
- `ringing`: Triggered when the session is ringing (incoming call)
- `answered`: Triggered when the session is answered
- `newInfo`: Triggered when new information is received (excluding transcription events)
- `transcription`: Triggered when transcription data is received from the remote peer
- `failed`: Triggered when the session fails
- `ended`: Triggered when the session ends
- `terminated`: Triggered when the session is terminated


### Sending Info Messages

You can use the Click to Call Widget API to send info messages during an active session via `session.sendInfo()`.

#### Sending Text Messages

To send text messages, pass the text content as the first argument:

```javascript
session.sendInfo("Yes");
```

#### Sending Text and Data Messages

If you want to add structured data to your message, pass it as a JSON object via a second argument, like this:

```javascript
session.sendInfo("Yes", {
  name: "John Doe",
  age: 30,
  preferences: {
    language: "en",
    notifications: true
  }
});
```

#### Sending Data-Only Messages

In case you want to send a data-only message, pass an empty string as the first argument:

```javascript
session.sendInfo("", {
  timestamp: Date.now(),
  ready: true
});
```

**Note:** Data-only messages will still contain an empty text field in the transmitted payload.

#### Receiving Info Messages

To handle incoming info messages from the remote peer, use the `newInfo` event listener:

```javascript
window.initWebRTCWidget(token, options).then((widget) => {
  widget.on('newRTCSession', (session) => {
    session.on('accepted', () => {
      // Send info messages after session is accepted
      session.sendInfo("Ready to proceed");
    });

    // Listen for incoming info messages
    session.on('newInfo', ({ originator, info }) => {
      if (originator === 'remote') {
        const parsedData = JSON.parse(info.body);
        console.log('Received data:', parsedData);
      }
    });
  });
});
```

#### Receiving Transcription Events

The widget automatically separates transcription data from regular info messages. Transcription events are emitted separately via the `transcription` event:

```javascript
window.initWebRTCWidget(token, options).then((widget) => {
  widget.on('newRTCSession', (session) => {
    // Listen for transcription events
    session.on('transcription', (transcription) => {
      console.log('Transcription originator:', transcription.originator);
      console.log('Transcription messages:', transcription.messages);
      
      // transcription.messages is an array of message objects
      transcription.messages.forEach((message) => {
        console.log('Text:', message.text);
      });
    });
  });
});
```

**Note:** Transcription events are automatically filtered from `newInfo` events. If an info message contains a `_transcription` property, it will only be emitted as a `transcription` event, not as `newInfo`.

**Technical Details:**
- Info messages can only be sent during an active session (after the call is accepted)
- The method sends data as JSON with content type `application/json`
- The payload is automatically structured as: `{ text: "your message", data: { your: "json" } }`
- Transcription events are parsed and emitted separately for easier handling

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

### UI Customization

The widget allows customization of UI labels through the initialization options. You can override the default labels by passing a `ui` object in the options:

```javascript
window.initWebRTCWidget(token, {
  userId: 'user123',  // Optional: User ID for SIP authentication
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
- Uses JsSIP for WebRTC signaling
- Powered by Cognigy.AI
