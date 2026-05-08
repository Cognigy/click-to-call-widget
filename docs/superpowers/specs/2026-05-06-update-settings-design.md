# updateSettings API — Design Spec

**Date:** 2026-05-06  
**Project:** click-to-call-widget  
**Reference:** Webchat `updateSettings` implementation

---

## Goal

Expose an `updateSettings` method on the widget instance returned by `initWebRTCWidget`, allowing consumers to update UI-facing configuration at runtime without re-initialising the widget. Mirrors the Webchat `updateSettings` pattern.

---

## Scope

### Updatable (via `IUpdateableSettings`)
- `IOptions` fields: `ui.labels`, `widgetOverrides`
- `IWebrtcWidgetConfig` fields (minus `active`): `label`, `tagline`, `theme`, `avatarLogoUrl`, `transcription`, `basePanelBackgroundColor`, `demoPage`
- `ISettings` fields: `privacyNotice`, `transcription`

### Protected (never updatable)
- `ISipConnectivityInfo` (`username`, `password`, `wsUri`, `realm`, `applicationSid`)
- `IEndpointSettings` core fields: `snapshotId`, `endpointUrlToken`, `endpointName`, `channel`, `localeReferenceId`, `collectAnalytics`, `active`, `version`
- `IOptions` fields: `userId`, `demoMode`

---

## Architecture

### 1. Type Definitions — `src/types/index.ts`

Add a new intersection type. All existing interfaces (`IOptions`, `IWebrtcWidgetConfig`, `ISettings`) remain **unchanged**.

```typescript
type IUpdateableSettings = Omit<Partial<IOptions>, 'userId' | 'demoMode'> & {
  webrtcWidgetConfig?: Partial<Omit<IWebrtcWidgetConfig, 'active'>>;
  settings?: Partial<ISettings>;
};
```

Add `UPDATE_SETTINGS` to the `ActionTypes` enum:

```typescript
enum ActionTypes {
  SET_DATA = "SET_DATA",
  SET_OPTIONS = "SET_OPTIONS",
  SET_LABELS = "SET_LABELS",
  SET_USER_ID = "SET_USER_ID",
  UPDATE_SETTINGS = "UPDATE_SETTINGS",
}
```

Add `IUpdateableSettings` to the existing `export type` line.

---

### 2. Reducer — `src/components/WebrtcContextProvider.tsx`

Add a new `UPDATE_SETTINGS` case to the existing reducer. Uses the same spread-based merge strategy already in use for `SET_OPTIONS` (no lodash). The existing `SET_OPTIONS` case is untouched.

```typescript
case ActionTypes.UPDATE_SETTINGS: {
  const { webrtcWidgetConfig, settings, ...optionFields } = action.payload;
  return {
    ...state,
    options: {
      ...state.options,
      ...(optionFields.ui && {
        ui: {
          ...state.options?.ui,
          ...optionFields.ui,
          labels: {
            ...state.options?.ui?.labels,
            ...optionFields.ui?.labels,
          },
        },
      }),
      ...(optionFields.widgetOverrides && {
        widgetOverrides: {
          ...state.options?.widgetOverrides,
          ...optionFields.widgetOverrides,
        },
      }),
    },
    ...(settings && {
      settings: {
        ...state.settings,
        ...settings,
        ...(settings.privacyNotice && {
          privacyNotice: {
            ...state.settings?.privacyNotice,
            ...settings.privacyNotice,
          },
        }),
      },
    }),
    ...(webrtcWidgetConfig && {
      endpointSettings: {
        ...state.endpointSettings,
        webrtcWidgetConfig: {
          ...state.endpointSettings?.webrtcWidgetConfig,
          ...webrtcWidgetConfig,
        },
      },
    }),
  };
}
```

Merge behaviour per slice:
- `optionFields` (`ui`, `widgetOverrides`) → spread-merged into `state.options`, with nested objects (`ui.labels`, `widgetOverrides`) merged individually — same pattern as `SET_OPTIONS`
- `webrtcWidgetConfig` → spread-merged into `state.endpointSettings.webrtcWidgetConfig`
- `settings` → spread-merged into `state.settings`, with `privacyNotice` merged individually
- Slices absent from the payload are left untouched

Also add a `WebrtcDispatchContext` alongside the existing `WebrtcContext`, so that `VoiceBotWidget` (and any other component) can access `dispatch` without it being threaded as a prop:

```typescript
export const WebrtcDispatchContext = createContext<Dispatch<any>>(() => {});

// Inside WebrtcContextProvider:
<WebrtcContext.Provider value={state}>
  <WebrtcDispatchContext.Provider value={dispatch}>
    {children}
  </WebrtcDispatchContext.Provider>
</WebrtcContext.Provider>
```

Export a `useWebrtcDispatch` hook:
```typescript
export const useWebrtcDispatch = () => useContext(WebrtcDispatchContext);
```

---

### 3. Imperative Handle — `src/components/VoiceBotWidget.tsx`

`WebrtcContext` currently exposes only state. `VoiceBotWidget` has its own `dispatch` but it belongs to the call state reducer (`callReducer`), not `webrtcReducer`. The new `WebrtcDispatchContext` (section 2) provides `webrtcReducer`'s dispatch.

Add `updateSettings` to `useImperativeHandle` alongside the existing `.on()`:

```typescript
const webrtcDispatch = useWebrtcDispatch();

useImperativeHandle(ref, () => ({
  on: eventHandler,
  updateSettings: (settings: IUpdateableSettings) => {
    webrtcDispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: settings });
  },
}), [eventHandler, webrtcDispatch]);
```

---

### 4. Public API — `src/main.tsx`

Update the return type of `initWebRTCWidget` and the `Window` interface to expose `updateSettings`. No logic changes — type annotation only.

Consumer usage after the change:

```typescript
const widget = await window.initWebRTCWidget(tokenUrl, options);

// Update UI labels at runtime
widget.updateSettings({ ui: { labels: { callButton: 'Call Now' } } });

// Update theme and privacy notice
widget.updateSettings({
  widgetOverrides: { theme: 'dark' },
  settings: { privacyNotice: { enabled: false } },
});

// Update widget config from server shape
widget.updateSettings({
  webrtcWidgetConfig: { tagline: 'Chat with us', avatarLogoUrl: 'https://...' },
});
```

---

## Data Flow

```
consumer calls widget.updateSettings(payload)
  → VoiceBotWidget.useImperativeHandle
    → dispatch({ type: UPDATE_SETTINGS, payload })
      → WebrtcContextProvider reducer
        → deep merge per slice (options / webrtcWidgetConfig / settings)
          → context value updated
            → connected components re-render
```

---

## Error Handling

- No runtime guards needed — TypeScript enforces the protected fields at compile time via `Omit<IWebrtcWidgetConfig, 'active'>` and the type boundary
- Calling `updateSettings` during an active call is safe: only UI state is updated, SIP session is unaffected
- Calling before initialisation is impossible — `updateSettings` only exists on the returned widget ref

---

## Testing

### Reducer unit tests (Vitest)
- `UPDATE_SETTINGS` deep-merges `options` fields correctly
- `UPDATE_SETTINGS` deep-merges `settings.privacyNotice` correctly
- `UPDATE_SETTINGS` deep-merges `webrtcWidgetConfig` fields correctly
- `UPDATE_SETTINGS` does not overwrite `webrtcWidgetConfig.active`
- `UPDATE_SETTINGS` does not touch `sipConnectivityInfo`
- Partial payload leaves untouched slices unchanged
- Existing `SET_OPTIONS` behaviour is unaffected

### Imperative handle integration test
- `widget.updateSettings(...)` triggers context update and component re-render with new values

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `IUpdateableSettings` type, `UPDATE_SETTINGS` to `ActionTypes`, export |
| `src/components/WebrtcContextProvider.tsx` | Add `UPDATE_SETTINGS` reducer case, `WebrtcDispatchContext`, `useWebrtcDispatch` hook |
| `src/components/VoiceBotWidget.tsx` | Add `updateSettings` to `useImperativeHandle` using `useWebrtcDispatch` |
| `src/main.tsx` | Update return type to include `updateSettings` |
| `src/spec/*.spec.ts` | New unit + integration tests |
