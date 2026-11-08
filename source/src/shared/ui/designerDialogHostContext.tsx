import * as React from 'react';

/** True when rendered inside a native designer `<dialog>` — HeroUI popovers must use native controls there. */
export const DesignerDialogHostContext = React.createContext(false);

export const useDesignerDialogHost = (): boolean => React.useContext(DesignerDialogHostContext);
