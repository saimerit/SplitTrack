import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
          <p className="text-gray-600 mb-4">Application crashed. Check console for full trace.</p>
          
          <div className="bg-gray-100 p-4 rounded text-left overflow-auto text-xs text-red-500 border border-red-200 w-full max-w-2xl">
            <p className="font-bold mb-2">Error Message:</p>
            {/* Safer error display */}
            <pre>{this.state.error?.message || "Unknown Error"}</pre>
            
            <p className="font-bold mt-4 mb-2">Stack:</p>
            <pre>{this.state.errorInfo?.componentStack || "No stack trace"}</pre>
          </div>

          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;