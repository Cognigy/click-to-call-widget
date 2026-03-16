import { http, HttpResponse } from "msw";
import mockData from "./mock.json";

export const handlers = [
	// Add your mock handlers here
	// Example:
	http.get("/:token", () => {
		return HttpResponse.json(mockData);
	}),
];
