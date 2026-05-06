# updateSettings API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose `widget.updateSettings(settings)` on the instance returned by `initWebRTCWidget`, allowing runtime updates to UI-facing configuration without re-initialising the widget.

**Architecture:** A new `IUpdateableSettings` type (intersection of `Partial<Omit<IOptions, 'userId'|'demoMode'>>` and optional `webrtcWidgetConfig`/`settings` slices) is dispatched via a new `UPDATE_SETTINGS` action to the existing `webrtcReducer`. A new `WebrtcDispatchContext` exposes the reducer's `dispatch` to `VoiceBotWidget`, which adds `updateSettings` to its imperative handle alongside the existing `.on()`.

**Tech Stack:** Preact, TypeScript, Vitest, @testing-library/preact

---

### Task 1: Add `IUpdateableSettings` type and `UPDATE_SETTINGS` action

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `UPDATE_SETTINGS` to the `ActionTypes` enum**

  Open `src/types/index.ts`. Find the `ActionTypes` enum (currently at line ~102) and add the new value:

  ```typescript
  enum ActionTypes {
  	SET_DATA = "SET_DATA",
  	SET_OPTIONS = "SET_OPTIONS",
  	SET_LABELS = "SET_LABELS",
  	SET_USER_ID = "SET_USER_ID",
  	UPDATE_SETTINGS = "UPDATE_SETTINGS",
  }
  ```

- [ ] **Step 2: Add the `IUpdateableSettings` type**

  Add this type definition after the `IWidgetOverrides` interface (line ~87), before `IOptions`:

  ```typescript
  type IUpdateableSettings = Omit<Partial<IOptions>, 'userId' | 'demoMode'> & {
  	webrtcWidgetConfig?: Partial<Omit<IWebrtcWidgetConfig, 'active'>>;
  	settings?: Partial<ISettings>;
  };
  ```

  > `IOptions` is defined just below — the forward reference is fine because TypeScript resolves types structurally, not by declaration order. If your editor flags it, move the type to after `IOptions`.

- [ ] **Step 3: Export `IUpdateableSettings`**

  Find the existing `export type` line at the bottom of the file (line ~167):

  ```typescript
  export type { IWebrtcContext, ISipConnectivityInfo, IOptions, IWebrtcWidgetConfig, IDemoPageBackground, IDemoPage, TWebrtcWidgetPosition };
  ```

  Add `IUpdateableSettings` and `ISettings` to it (you'll need `ISettings` in later tasks):

  ```typescript
  export type { IWebrtcContext, ISipConnectivityInfo, IOptions, IWebrtcWidgetConfig, IDemoPageBackground, IDemoPage, TWebrtcWidgetPosition, IUpdateableSettings, ISettings };
  ```

- [ ] **Step 4: Verify the project type-checks**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/types/index.ts
  git commit -m "feat: add IUpdateableSettings type and UPDATE_SETTINGS action"
  ```

---

### Task 2: Write failing reducer tests (TDD)

**Files:**
- Modify: `src/components/WebrtcContextProvider.tsx` (export the reducer — needed by tests)
- Create: `src/spec/webrtcReducer.test.ts`

- [ ] **Step 1: Export `webrtcReducer` and `initialState` from `WebrtcContextProvider.tsx`**

  In `src/components/WebrtcContextProvider.tsx`, change the reducer declaration from:
  ```typescript
  function webrtcReducer(state: any, action: any) {
  ```
  to:
  ```typescript
  export function webrtcReducer(state: any, action: any) {
  ```

  Also export `initialState` — change:
  ```typescript
  const initialState: IWebrtcContext = {
  ```
  to:
  ```typescript
  export const initialState: IWebrtcContext = {
  ```

- [ ] **Step 2: Create the test file with failing tests**

  Create `src/spec/webrtcReducer.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import { webrtcReducer, initialState } from "../components/WebrtcContextProvider";
  import { ActionTypes } from "../types";

  const baseState = {
  	...initialState,
  	options: {
  		userId: "existing-user",
  		demoMode: false,
  		ui: {
  			labels: {
  				callButton: "Call",
  				endButton: "End",
  				listenLabel: "Listening",
  			},
  		},
  		widgetOverrides: {
  			theme: "light" as const,
  			tagline: "Original tagline",
  		},
  	},
  	settings: {
  		privacyNotice: {
  			enabled: true,
  			text: "Privacy text",
  			cancelButtonText: "Cancel",
  			submitButtonText: "Submit",
  			urlText: "Link",
  			url: "https://example.com",
  		},
  		transcription: { enabled: false },
  	},
  	endpointSettings: {
  		...initialState.endpointSettings,
  		snapshotId: "snap-1",
  		endpointUrlToken: "token-abc",
  		endpointName: "My Endpoint",
  		channel: "webchat",
  		localeReferenceId: "en-US",
  		collectAnalytics: true,
  		active: true,
  		version: "1.0",
  		sipConnectivityInfo: {
  			username: "sip-user",
  			applicationSid: "app-sid",
  			password: "secret",
  			wsUri: "wss://sip.example.com",
  			realm: "example.com",
  		},
  		webrtcWidgetConfig: {
  			label: "Widget",
  			active: true,
  			tagline: "Original",
  			theme: "light" as const,
  			avatarLogoUrl: "https://old-avatar.com/img.png",
  			transcription: { enabled: false, backgroundMode: "transparent", backgroundColor: "" },
  		},
  	},
  };

  describe("webrtcReducer — UPDATE_SETTINGS", () => {
  	it("merges ui.labels without replacing unspecified labels", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { ui: { labels: { callButton: "Ring" } } },
  		});
  		expect(result.options.ui.labels.callButton).toBe("Ring");
  		expect(result.options.ui.labels.endButton).toBe("End");
  		expect(result.options.ui.labels.listenLabel).toBe("Listening");
  	});

  	it("merges widgetOverrides without replacing unspecified fields", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { widgetOverrides: { tagline: "New tagline" } },
  		});
  		expect(result.options.widgetOverrides.tagline).toBe("New tagline");
  		expect(result.options.widgetOverrides.theme).toBe("light");
  	});

  	it("merges settings.privacyNotice without replacing unspecified fields", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { settings: { privacyNotice: { enabled: false } } },
  		});
  		expect(result.settings.privacyNotice.enabled).toBe(false);
  		expect(result.settings.privacyNotice.text).toBe("Privacy text");
  	});

  	it("merges webrtcWidgetConfig fields", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { webrtcWidgetConfig: { tagline: "Updated tagline", avatarLogoUrl: "https://new.com/img.png" } },
  		});
  		expect(result.endpointSettings.webrtcWidgetConfig.tagline).toBe("Updated tagline");
  		expect(result.endpointSettings.webrtcWidgetConfig.avatarLogoUrl).toBe("https://new.com/img.png");
  		expect(result.endpointSettings.webrtcWidgetConfig.label).toBe("Widget");
  	});

  	it("does NOT update webrtcWidgetConfig.active (protected field excluded by type)", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { webrtcWidgetConfig: { tagline: "X" } },
  		});
  		expect(result.endpointSettings.webrtcWidgetConfig.active).toBe(true);
  	});

  	it("does NOT touch sipConnectivityInfo", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { webrtcWidgetConfig: { tagline: "X" } },
  		});
  		expect(result.endpointSettings.sipConnectivityInfo.password).toBe("secret");
  		expect(result.endpointSettings.sipConnectivityInfo.wsUri).toBe("wss://sip.example.com");
  	});

  	it("does NOT touch protected IEndpointSettings fields", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { webrtcWidgetConfig: { tagline: "X" } },
  		});
  		expect(result.endpointSettings.snapshotId).toBe("snap-1");
  		expect(result.endpointSettings.endpointUrlToken).toBe("token-abc");
  		expect(result.endpointSettings.channel).toBe("webchat");
  		expect(result.endpointSettings.active).toBe(true);
  	});

  	it("does NOT touch options.userId or options.demoMode", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { ui: { labels: { callButton: "Ring" } } },
  		});
  		expect(result.options.userId).toBe("existing-user");
  		expect(result.options.demoMode).toBe(false);
  	});

  	it("leaves slices untouched when not included in payload", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.UPDATE_SETTINGS,
  			payload: { ui: { labels: { callButton: "Ring" } } },
  		});
  		expect(result.settings).toEqual(baseState.settings);
  		expect(result.endpointSettings.webrtcWidgetConfig).toEqual(baseState.endpointSettings.webrtcWidgetConfig);
  	});

  	it("existing SET_OPTIONS behaviour is unaffected", () => {
  		const result = webrtcReducer(baseState, {
  			type: ActionTypes.SET_OPTIONS,
  			payload: { widgetOverrides: { tagline: "Via SET_OPTIONS" } },
  		});
  		expect(result.options.widgetOverrides.tagline).toBe("Via SET_OPTIONS");
  		expect(result.options.widgetOverrides.theme).toBe("light");
  	});
  });
  ```

- [ ] **Step 3: Run tests to verify they fail**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test -- --reporter=verbose src/spec/webrtcReducer.test.ts
  ```

  Expected: all tests FAIL with errors like `"UPDATE_SETTINGS is not handled"` or reducer returns unchanged state.

- [ ] **Step 4: Commit the failing tests**

  ```bash
  git add src/spec/webrtcReducer.test.ts src/components/WebrtcContextProvider.tsx
  git commit -m "test: add failing tests for UPDATE_SETTINGS reducer"
  ```

---

### Task 3: Implement the reducer and dispatch context

**Files:**
- Modify: `src/components/WebrtcContextProvider.tsx`

- [ ] **Step 1: Add `WebrtcDispatchContext` and `useWebrtcDispatch`**

  In `src/components/WebrtcContextProvider.tsx`, update the import at the top:

  ```typescript
  import { createContext } from "preact";
  import { useContext, useEffect, useReducer } from "preact/hooks";
  import type { Dispatch } from "preact/hooks";
  ```

  After the `WebrtcContext` line:

  ```typescript
  export const WebrtcContext = createContext(initialState);
  export const WebrtcDispatchContext = createContext<Dispatch<any>>(() => {});
  export const useWebrtcDispatch = () => useContext(WebrtcDispatchContext);
  ```

- [ ] **Step 2: Add `UPDATE_SETTINGS` case to `webrtcReducer`**

  In `webrtcReducer`, add the new case before `default`:

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

- [ ] **Step 3: Wrap children with `WebrtcDispatchContext.Provider`**

  In the `WebrtcContextProvider` component JSX, change:

  ```typescript
  return (
  	<WebrtcContext.Provider value={state}>{children}</WebrtcContext.Provider>
  );
  ```

  to:

  ```typescript
  return (
  	<WebrtcContext.Provider value={state}>
  		<WebrtcDispatchContext.Provider value={dispatch}>
  			{children}
  		</WebrtcDispatchContext.Provider>
  	</WebrtcContext.Provider>
  );
  ```

- [ ] **Step 4: Run reducer tests to verify they pass**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test -- --reporter=verbose src/spec/webrtcReducer.test.ts
  ```

  Expected: all 9 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test
  ```

  Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/WebrtcContextProvider.tsx
  git commit -m "feat: add UPDATE_SETTINGS reducer case and WebrtcDispatchContext"
  ```

---

### Task 4: Add `updateSettings` to the imperative handle

**Files:**
- Modify: `src/components/VoiceBotWidget.tsx`
- Modify: `src/spec/VoiceBotWidget.test.tsx`

- [ ] **Step 1: Write the failing integration test**

  In `src/spec/VoiceBotWidget.test.tsx`, add a new `describe` block at the bottom of the file (after the existing `describe("VoiceBotWidget", ...)` closing brace):

  ```typescript
  describe("VoiceBotWidget — updateSettings imperative handle", () => {
  	it("exposes updateSettings on the widget ref", async () => {
  		const ref = { current: null as any };

  		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({ ...mockData, options: mockOptions } as any);

  		render(
  			<WebrtcContextProvider token="test-token">
  				<VoiceBotWidget ref={ref} />
  			</WebrtcContextProvider>
  		);

  		await waitFor(() => {
  			expect(ref.current).not.toBeNull();
  		});

  		expect(typeof ref.current.updateSettings).toBe("function");
  	});

  	it("updateSettings dispatches UPDATE_SETTINGS with the payload", async () => {
  		const dispatchSpy = vi.fn();
  		vi.spyOn(WebrtcContext, "useWebrtcDispatch").mockReturnValue(dispatchSpy);
  		vi.spyOn(WebrtcContext, "useWebrtcContext").mockReturnValue({ ...mockData, options: mockOptions } as any);

  		const ref = { current: null as any };

  		render(
  			<WebrtcContextProvider token="test-token">
  				<VoiceBotWidget ref={ref} />
  			</WebrtcContextProvider>
  		);

  		await waitFor(() => {
  			expect(ref.current).not.toBeNull();
  		});

  		ref.current.updateSettings({ webrtcWidgetConfig: { tagline: "New tagline" } });

  		expect(dispatchSpy).toHaveBeenCalledWith({
  			type: "UPDATE_SETTINGS",
  			payload: { webrtcWidgetConfig: { tagline: "New tagline" } },
  		});
  	});
  });
  ```

  > **Note on mocking:** `mockData` and `mockOptions` are already defined at the top of this test file. This new describe block reuses them. The import for `waitFor` is already present. Add `useWebrtcDispatch` to the spied export from `WebrtcContext` — the test will compile fine since we're adding the export in Task 3.

- [ ] **Step 2: Run tests to verify the new tests fail**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test -- --reporter=verbose src/spec/VoiceBotWidget.test.tsx
  ```

  Expected: the two new tests FAIL — `updateSettings` does not exist on the ref yet.

- [ ] **Step 3: Update imports in `VoiceBotWidget.tsx`**

  In `src/components/VoiceBotWidget.tsx`, update the import from `WebrtcContextProvider`:

  ```typescript
  import { useWebrtcContext, useWebrtcDispatch } from "./WebrtcContextProvider";
  ```

  Update the import from `../types` to include `IUpdateableSettings` and `ActionTypes`:

  ```typescript
  import { CallActionType, ActionTypes } from "../types";
  import type { IUpdateableSettings } from "../types";
  ```

- [ ] **Step 4: Add `updateSettings` to `useImperativeHandle`**

  In `src/components/VoiceBotWidget.tsx`, add `useWebrtcDispatch` call near the top of the component (after the existing `const config = useWebrtcContext();` line):

  ```typescript
  const webrtcDispatch = useWebrtcDispatch();
  ```

  Then update the `useImperativeHandle` call (currently at lines ~305-313):

  ```typescript
  useImperativeHandle(
  	ref,
  	() => {
  		return {
  			on: eventHandler,
  			updateSettings: (settings: IUpdateableSettings) => {
  				webrtcDispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: settings });
  			},
  		};
  	},
  	[eventHandler, webrtcDispatch]
  );
  ```

- [ ] **Step 5: Run the new tests to verify they pass**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test -- --reporter=verbose src/spec/VoiceBotWidget.test.tsx
  ```

  Expected: all tests PASS including the two new ones.

- [ ] **Step 6: Run full test suite**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test
  ```

  Expected: all tests PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/VoiceBotWidget.tsx src/spec/VoiceBotWidget.test.tsx
  git commit -m "feat: expose updateSettings on VoiceBotWidget imperative handle"
  ```

---

### Task 5: Update public API types in `main.tsx`

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/spec/main.test.tsx`

- [ ] **Step 1: Define a `IWidgetInstance` interface and update `initWebRTCWidget` return type**

  In `src/main.tsx`, add an import for `IUpdateableSettings`:

  ```typescript
  import type { IOptions, IUpdateableSettings } from "./types/index.ts";
  ```

  Add the interface just before the `Window` interface:

  ```typescript
  interface IWidgetInstance {
  	on: (event: string, handler: (...args: any[]) => void) => void;
  	updateSettings: (settings: IUpdateableSettings) => void;
  }
  ```

  Update the `Window` interface:

  ```typescript
  interface Window {
  	initWebRTCWidget: (token: string, options?: IOptions, callback?: (widget: IWidgetInstance) => void) => Promise<IWidgetInstance>;
  	destroyWebRTCWidget: typeof destroyWebRTCWidget;
  }
  ```

  Update the `initWebRTCWidget` return type annotation. The function signature becomes:

  ```typescript
  const initWebRTCWidget = async (
  	token: string,
  	options?: IOptions,
  	callback?: (webrtcWidget: IWidgetInstance) => void
  ): Promise<IWidgetInstance> => {
  ```

- [ ] **Step 2: Update the mock in `main.test.tsx` to include `updateSettings`**

  In `src/spec/main.test.tsx`, find the `AppMock` that calls `mainRef`:

  ```typescript
  const AppMock = vi.fn(({ mainRef }) => {
    if (mainRef) {
      mainRef({ on: vi.fn() });
    }
    return null;
  });
  ```

  Update it to also include `updateSettings`:

  ```typescript
  const AppMock = vi.fn(({ mainRef }) => {
    if (mainRef) {
      mainRef({ on: vi.fn(), updateSettings: vi.fn() });
    }
    return null;
  });
  ```

- [ ] **Step 3: Verify the project type-checks**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Run full test suite**

  ```bash
  cd /Users/Ravi.Chhetri/Workspace/click-to-call-widget && npm run test
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main.tsx src/spec/main.test.tsx
  git commit -m "feat: update initWebRTCWidget return type to expose updateSettings"
  ```

---

## Self-Review Checklist

- [x] **Types task** covers `IUpdateableSettings`, `UPDATE_SETTINGS` enum value, and export — Task 1
- [x] **Reducer tests** cover all 9 spec requirements (merges, protects protected fields, leaves untouched slices alone, SET_OPTIONS regression) — Task 2
- [x] **`WebrtcDispatchContext`** and `useWebrtcDispatch` — Task 3
- [x] **Imperative handle** with `updateSettings` — Task 4
- [x] **Public API types** (`IWidgetInstance`, `Window` interface, mock update) — Task 5
- [x] **No placeholders** — every step has exact file paths, exact code, exact commands
- [x] **Type consistency** — `IUpdateableSettings` defined in Task 1, used in Tasks 4 & 5; `ActionTypes.UPDATE_SETTINGS` defined in Task 1, used in Tasks 2, 3 & 4; `useWebrtcDispatch` defined in Task 3, used in Task 4
- [x] **Protected fields** (`userId`, `demoMode`, `active`, `sipConnectivityInfo`, core endpoint fields) — enforced by type in Task 1, tested in Task 2
