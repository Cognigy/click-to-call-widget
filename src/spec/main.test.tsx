import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import "../main";
import App from "../components/WebrtcWidget.tsx";

// Mock App component with ref handling
vi.mock("../components/WebrtcWidget.tsx", () => {
  const AppMock = vi.fn(({ mainRef }) => {
    // Call the ref callback immediately with a mock ref
    if (mainRef) {
      mainRef({ on: vi.fn(), updateSettings: vi.fn() });
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
});
