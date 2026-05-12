"use client";

import { Component, ReactNode } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? "Something went wrong." };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: "" });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#13111f]">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white/90 mb-2">Something went wrong</h2>
            <p className="text-sm text-white/45 leading-relaxed">
              An unexpected error occurred. Refreshing the page usually fixes it.
            </p>
            {this.state.message && (
              <p className="mt-3 text-xs text-white/25 font-mono bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-left break-all">
                {this.state.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-violet-900/30"
          >
            <RefreshCw size={16} />
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
