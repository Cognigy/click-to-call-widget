import { http, HttpResponse } from "msw";
// `mock.example.json` is committed and credential-free, so `npm test` and
// `npm run dev` work on a fresh clone. To exercise the widget against a real
// endpoint locally, copy it to `mock.json` (git-ignored) and import that
// instead — do not commit the copy.
import mockData from "./mock.example.json";

export const handlers = [
	// Endpoint config lookup: the widget fetches its whole configuration from
	// the token URL it is initialised with.
	http.get("/:token", () => {
		return HttpResponse.json(mockData);
	}),
];
