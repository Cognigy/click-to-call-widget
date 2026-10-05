import { http, HttpResponse } from "msw";
// Credential-free fixture; copy it to the git-ignored mock.json to point at a real endpoint.
import mockData from "./mock.example.json";

export const handlers = [
	http.get("/:token", () => {
		return HttpResponse.json(mockData);
	}),
];
