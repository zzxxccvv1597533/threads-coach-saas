import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { isDatabaseError, ErrorType, classifyError } from '@/lib/errorUtils';

interface ErrorState {
  hasError: boolean;
  errorType: ErrorType | null;
  errorMessage: string | null;
  showMaintenance: boolean;
}

interface ErrorContextType extends ErrorState {
  setError: (error: unknown) => void;
  clearError: () => void;
  checkDatabaseError: (error: unknown) => boolean;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

const initialState: ErrorState = {
  hasError: false,
  errorType: null,
  errorMessage: null,
  showMaintenance: false
};

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErrorState>(initialState);

  const setError = useCallback((error: unknown) => {
    const errorType = classifyError(error);
    const isDbError = isDatabaseError(error);
    
    setState({
      hasError: true,
      errorType,
      errorMessage: error instanceof Error ? error.message : String(error),
      showMaintenance: isDbError
    });
  }, []);

  const clearError = useCallback(() => {
    setState(initialState);
  }, []);

  const checkDatabaseError = useCallback((error: unknown): boolean => {
    const isDbError = isDatabaseError(error);
    if (isDbError) {
      setError(error);
    }
    return isDbError;
  }, [setError]);

  return (
    <ErrorContext.Provider value={{
      ...state,
      setError,
      clearError,
      checkDatabaseError
    }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}
