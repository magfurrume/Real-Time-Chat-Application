// Create a CallErrorBoundary.js
"use client"

import { useState } from "react";

export const CallErrorBoundary = ({ children }) => {
  const [error, setError] = useState(null);

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded-lg">
        <h3 className="font-bold">Call Error</h3>
        <p>{error.message}</p>
        <button 
          onClick={() => setError(null)}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  try {
    return children;
  } catch (err) {
    setError(err);
    return null;
  }
};

// Usage in ChatWindow:
<CallErrorBoundary>
  {/* Your call-related components */}
</CallErrorBoundary>