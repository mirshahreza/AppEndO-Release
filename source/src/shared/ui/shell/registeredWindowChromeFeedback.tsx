import React, { createContext, useContext } from 'react';

type RegisteredWindowChromeFeedbackComponent = React.ComponentType;

const RegisteredWindowChromeFeedbackContext = createContext<RegisteredWindowChromeFeedbackComponent | null>(null);

export type RegisteredWindowChromeFeedbackProviderProps = {
  component: RegisteredWindowChromeFeedbackComponent;
  children: React.ReactNode;
};

export function RegisteredWindowChromeFeedbackProvider({
  component,
  children,
}: RegisteredWindowChromeFeedbackProviderProps): React.ReactElement {
  return (
    <RegisteredWindowChromeFeedbackContext.Provider value={component}>
      {children}
    </RegisteredWindowChromeFeedbackContext.Provider>
  );
}

/** Renders the app-registered feedback entry (floating windows + modal headers). */
export function WindowChromeFeedbackButton(): React.ReactNode {
  const Component = useContext(RegisteredWindowChromeFeedbackContext);
  if (!Component) {
    return null;
  }
  return <Component />;
}
