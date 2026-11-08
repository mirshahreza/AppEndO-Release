# How to configure shell navigation

Use **navigationRef** on platform navigation nodes and shell nav region slots to point at a menu manifest under `platform-registry/navigation/{id}.json`.

1. Open **Studio → Navigations** and note the manifest id (for example `studio`).
2. Select the navigation node or shell nav slot in the Component Designer canvas.
3. In **Properties**, set **Navigation manifest** to that id.
4. Save the component and run preview to verify menu items resolve.
