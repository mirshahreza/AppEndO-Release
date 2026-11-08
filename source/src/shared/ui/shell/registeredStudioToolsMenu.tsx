import React, { createContext, useContext } from 'react';

type RegisteredStudioToolsMenuComponent = React.ComponentType;

const RegisteredStudioToolsMenuContext = createContext<RegisteredStudioToolsMenuComponent | null>(null);

export type RegisteredStudioToolsMenuProviderProps = {
  component: RegisteredStudioToolsMenuComponent;
  children: React.ReactNode;
};

export function RegisteredStudioToolsMenuProvider({
  component,
  children,
}: RegisteredStudioToolsMenuProviderProps): React.ReactElement {
  return (
    <RegisteredStudioToolsMenuContext.Provider value={component}>
      {children}
    </RegisteredStudioToolsMenuContext.Provider>
  );
}

/** Renders the app-registered Studio tools menu (floating windows + modal headers). */
export function WindowChromeStudioToolsMenu(): React.ReactNode {
  const Component = useContext(RegisteredStudioToolsMenuContext);
  if (!Component) {
    return null;
  }
  return <Component />;
}
