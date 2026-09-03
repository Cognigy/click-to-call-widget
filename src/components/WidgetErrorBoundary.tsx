import { Component, type ComponentChildren } from "preact";

interface WidgetErrorBoundaryProps {
	children: ComponentChildren;
	/** Called once, with the first error thrown anywhere below this boundary. */
	onError: (error: Error) => void;
}

interface WidgetErrorBoundaryState {
	hasFailed: boolean;
}

const toError = (thrown: unknown): Error =>
	thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Catches render/lifecycle errors from the widget tree and reports them to the
 * caller instead of letting them escape as an unhandled exception.
 *
 * Without this, a throw during the initial mount escaped `render()` inside a
 * `setTimeout` callback -- so it became an uncaught exception rather than a
 * promise rejection, and `initWebRTCWidget()` never settled.
 *
 * Scope: this covers errors Preact routes through `options._catchError` --
 * render, lifecycle methods and effects below the boundary. It cannot catch a
 * throw raised inside Preact's own re-render scheduler above the boundary; the
 * `settled` guard and init timeout in `main.tsx` are what keep such a case
 * from hanging.
 */
export class WidgetErrorBoundary extends Component<
	WidgetErrorBoundaryProps,
	WidgetErrorBoundaryState
> {
	state: WidgetErrorBoundaryState = { hasFailed: false };

	componentDidCatch(error: unknown) {
		// Stop rendering children so nothing re-enters the broken subtree, then
		// hand the error to the caller.
		this.setState({ hasFailed: true });
		this.props.onError(toError(error));
	}

	render() {
		return this.state.hasFailed ? null : this.props.children;
	}
}
