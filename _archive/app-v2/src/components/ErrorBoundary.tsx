import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { colors, fonts } from '@/tokens';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          padding: 32,
          gap: 16,
          background: colors.duskSand,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 24,
            fontWeight: 800,
            color: colors.deepDusk,
            textTransform: 'uppercase',
          }}
        >
          Something went wrong
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 14,
            lineHeight: '22px',
            color: colors.mutedText,
            maxWidth: 320,
          }}
        >
          An unexpected error occurred. Please try again.
        </span>
        <button
          onClick={() => this.setState({ hasError: false })}
          style={{
            marginTop: 8,
            padding: '12px 28px',
            borderRadius: 12,
            backgroundColor: colors.deepDusk,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              fontWeight: 600,
              color: colors.paleHorizon,
            }}
          >
            Try Again
          </span>
        </button>
      </div>
    );
  }
}
