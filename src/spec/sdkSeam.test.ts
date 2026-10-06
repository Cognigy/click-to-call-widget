import { WebRTCClient } from "@cognigy/click-to-call-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeUA, resetFakeJssip } from "./fakes/fakeJssip";
import { legacyConfig, serveConfig } from "./contract/harness";

vi.mock("jssip", async () => (await import("./fakes/fakeJssip")).fakeJssipModule);

beforeEach(() => resetFakeJssip());

describe("SDK test seam", () => {
	it("the SDK's jssip import is intercepted by vi.mock", async () => {
		serveConfig(legacyConfig());
		const client = new WebRTCClient({ endpointUrl: "/cfg-token" });

		await client.connect();

		expect(FakeUA.instances.length).toBe(1);
	});
});
