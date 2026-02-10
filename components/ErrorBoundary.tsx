import React from 'react';
import { captureException } from '../utils/sentry';
import { ErrorState } from './common/ErrorState';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureException(error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          message="Something unexpected happened"
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}
