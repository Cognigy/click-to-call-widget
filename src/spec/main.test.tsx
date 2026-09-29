import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitFor } from "@testing-library/preact";

import "../main";
import App from "../components/WebrtcWidget.tsx";
import { FakeUA, resetFakeJssip } from "./fakes/fakeJssip";
import { clickCall, clickEnd, lastSession, lastUA, legacyConfig, mountWidget, serveConfig } from "./contract/harness";

vi.mock("jssip", async () => (await import("./fakes/fakeJssip")).fakeJssipModule);

const mode = vi.hoisted(() => ({ renderRealApp: false, skipRef: false }));

// Mock App component with ref handling; `mode.renderRealApp` renders the real one.
vi.mock("../components/WebrtcWidget.tsx", async (importOriginal) => {
  const { h } = await import("preact");
  const actual = await importOriginal<typeof import("../components/WebrtcWidget.tsx")>();
  const AppMock = vi.fn((props) => {
    if (mode.renderRealApp) return h(actual.default, props);
    // Call the ref callback immediately with a mock ref
    if (props.mainRef && !mode.skipRef) {
      props.mainRef({ on: vi.fn() });
    }
    return null;
  });
  return {
    default: AppMock
  };
});

// Import after mocking

describe("WebRTC Widget Initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock render function
    vi.spyOn(document.body, "appendChild");

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up any added elements
    document.body.innerHTML = "";
  });

  it("should initialize with empty options when no options provided (userId is resolved by resolveUserId, see helpers.test.ts)", async () => {
    await window.initWebRTCWidget("test-token");

    expect(document.body.appendChild).toHaveBeenCalledWith(
      expect.any(HTMLDivElement)
    );

    expect(App).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "test-token",
        options: {}
      }),
      expect.any(Object)
    );
  });

  it("should initialize with provided userId in options", async () => {
    const customUserId = "custom-user-123";

    await window.initWebRTCWidget("test-token", { userId: customUserId });

    expect(App).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "test-token",
        options: {
          userId: customUserId
        }
      }),
      expect.any(Object)
    );
  });

  it("should initialize with empty options when empty options provided (userId is resolved by resolveUserId, see helpers.test.ts)", async () => {
    await window.initWebRTCWidget("test-token", {});

    expect(App).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "test-token",
        options: {}
      }),
      expect.any(Object)
    );
  });

  it("should create and append widget container to body", async () => {
    await window.initWebRTCWidget("test-token");

    const widgetContainer = document.querySelector("div");
    expect(widgetContainer).toBeTruthy();
    expect(document.body.contains(widgetContainer)).toBe(true);
  });

  describe("destroy before the widget ref is delivered", () => {
    afterEach(() => {
      mode.skipRef = false;
    });

    // Long enough for the 0ms init timer and one 500ms poll tick.
    const SETTLE_MS = 700;

    it("stops without rendering or settling when destroyed before render", async () => {
      const callback = vi.fn();
      const settled = vi.fn();
      window.initWebRTCWidget("test-token", {}, callback).then(settled, settled);
      window.destroyWebRTCWidget();

      await new Promise((r) => setTimeout(r, SETTLE_MS));
      expect(App).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(settled).not.toHaveBeenCalled();
    });

    it("stops polling without calling back or settling when destroyed while waiting for the ref", async () => {
      mode.skipRef = true;
      const callback = vi.fn();
      const settled = vi.fn();
      window.initWebRTCWidget("test-token", {}, callback).then(settled, settled);

      await waitFor(() => expect(App).toHaveBeenCalled());
      window.destroyWebRTCWidget();

      await new Promise((r) => setTimeout(r, SETTLE_MS));
      expect(callback).not.toHaveBeenCalled();
      expect(settled).not.toHaveBeenCalled();
    });
  });

  describe("with the real widget", () => {
    beforeEach(() => {
      mode.renderRealApp = true;
      resetFakeJssip();
    });

    afterEach(() => {
      mode.renderRealApp = false;
      window.destroyWebRTCWidget();
    });

    it.each(["remote hangup", "user end"])(
      "places a second call after %s on a new UA with a new legacy session",
      async (end) => {
        serveConfig(legacyConfig());
        const widget = await mountWidget({ userId: "u-1" });
        const sessions: { jssipRtcSession: unknown }[] = [];
        widget.on("newRTCSession", (s: { jssipRtcSession: unknown }) => sessions.push(s));

        await clickCall();
        await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });
        const firstUA = lastUA();
        const first = lastSession();
        first.progress();
        first.accept();
        if (end === "remote hangup") {
          // A remote BYE: JsSIP marks the session ended, then emits.
          (first as unknown as { _ended: boolean })._ended = true;
          first.emit("ended", { originator: "remote", cause: "Terminated" });
        } else {
          await clickEnd();
        }
        await waitFor(() => expect(firstUA.stop).toHaveBeenCalled());

        await clickCall();
        await waitFor(() => expect(FakeUA.instances).toHaveLength(2), { timeout: 3000 });
        const secondUA = lastUA();
        await waitFor(() => expect(secondUA.call).toHaveBeenCalledTimes(1), { timeout: 3000 });

        expect(firstUA.call).toHaveBeenCalledTimes(1);
        expect(sessions).toHaveLength(2);
        expect(sessions[1]).not.toBe(sessions[0]);
        expect(sessions[0].jssipRtcSession).toBe(first);
        expect(sessions[1].jssipRtcSession).toBe(lastSession());
      }
    );

    it("destroy mid-call terminates and silences legacy handlers", async () => {
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);
      try {
        serveConfig(legacyConfig());
        const widget = await mountWidget({ userId: "u-1" });
        const uaEvents = vi.fn();
        const sessionEvents = vi.fn();
        for (const name of ["connecting", "connected", "disconnected", "registrationFailed"]) {
          widget.on(name, uaEvents);
        }
        widget.on("newRTCSession", (s: { on: (e: string, h: () => void) => void }) => {
          for (const name of ["ringing", "answered", "newInfo", "transcription", "failed", "ended", "terminated"]) {
            s.on(name, sessionEvents);
          }
        });
        await clickCall();
        await waitFor(() => expect(lastUA().call).toHaveBeenCalled(), { timeout: 3000 });
        const session = lastSession();
        const ua = lastUA();
        session.progress();
        session.accept();
        expect(sessionEvents).toHaveBeenCalled();

        window.destroyWebRTCWidget();

        await waitFor(() => expect(session.terminate).toHaveBeenCalled());
        // Let the async client.destroy() settle before checking for silence.
        await new Promise((r) => setTimeout(r, 50));
        uaEvents.mockClear();
        sessionEvents.mockClear();

        session.receiveInfo('{"hello":1}');
        session.emit("ended", { originator: "remote", cause: "Terminated" });
        ua.emit("connected", {});
        ua.emit("disconnected", {});
        ua.emit("registrationFailed", { cause: "Rejected" });
        await new Promise((r) => setTimeout(r, 50));

        expect(uaEvents).not.toHaveBeenCalled();
        expect(sessionEvents).not.toHaveBeenCalled();
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    });
  });
});
