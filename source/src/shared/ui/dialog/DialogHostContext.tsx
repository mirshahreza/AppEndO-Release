import React, { createContext, useContext } from 'react';

/**
 * Marks descendants as living inside an AppDialogShell / CreateEditModalShell.
 * GridPagingFooter reads this to inset dialog footers 10px from the window edges.
 */
const DialogHostContext = createContext(false);

export const DialogHostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DialogHostContext.Provider value={true}>
    {children}
  </DialogHostContext.Provider>
);

export const useIsInsideDialogHost = (): boolean => useContext(DialogHostContext);
