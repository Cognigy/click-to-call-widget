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

// Without this, a mount-time throw escaped render() inside a setTimeout as an uncaught exception
// instead of a rejection, leaving initWebRTCWidget() unsettled. Only catches errors below the boundary
// (Preact's options._catchError); the `settled` guard + init timeout in main.tsx cover the rest.
export class WidgetErrorBoundary extends Component<
	WidgetErrorBoundaryProps,
	WidgetErrorBoundaryState
> {
	state: WidgetErrorBoundaryState = { hasFailed: false };

	componentDidCatch(error: unknown) {
		this.setState({ hasFailed: true });
		this.props.onError(toError(error));
	}

	render() {
		return this.state.hasFailed ? null : this.props.children;
	}
}
