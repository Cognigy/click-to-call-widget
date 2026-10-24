import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import "../main";
import App from "../components/WebrtcWidget.tsx";

// Mock App component with ref handling
vi.mock("../components/WebrtcWidget.tsx", () => {
  const AppMock = vi.fn(({ mainRef }) => {
    // Call the ref callback immediately with a mock ref
    if (mainRef) {
      mainRef({ on: vi.fn() });
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

  it("should initialize with empty options when no options provided (userId generated in context provider)", async () => {
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

  it("should initialize with empty options when empty options provided (userId generated in context provider)", async () => {
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
  describe("destroy or re-init before the widget mounts", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("mounts nothing when destroyed in the same tick as init", async () => {
      const callback = vi.fn();
      const settled = vi.fn();
      window.initWebRTCWidget("test-token", {}, callback).then(settled);
      window.destroyWebRTCWidget();

      await vi.runAllTimersAsync();

      expect(App).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(settled).not.toHaveBeenCalled();
      expect(document.body.children).toHaveLength(0);
    });

    it("stops polling for the widget ref after a destroy", async () => {
      vi.mocked(App).mockImplementationOnce(() => null as never); // never produces a ref
      const settled = vi.fn();
      window.initWebRTCWidget("test-token").then(settled);
      await vi.advanceTimersByTimeAsync(0);
      expect(App).toHaveBeenCalledTimes(1);

      window.destroyWebRTCWidget();
      await vi.advanceTimersByTimeAsync(600);

      expect(vi.getTimerCount()).toBe(0);
      expect(settled).not.toHaveBeenCalled();
    });

    it("leaves only the newest widget when init is called twice back to back", async () => {
      const first = vi.fn();
      const second = vi.fn();
      window.initWebRTCWidget("first-token", {}, first);
      window.initWebRTCWidget("second-token", {}, second);

      await vi.runAllTimersAsync();

      expect(App).toHaveBeenCalledTimes(1);
      expect(App).toHaveBeenCalledWith(
        expect.objectContaining({ token: "second-token" }),
        expect.any(Object)
      );
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      expect(document.body.children).toHaveLength(1);
    });
  });
});
