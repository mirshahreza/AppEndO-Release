# User Guide — Component Designer & App Builder (راهنمای کاربر)

This guide contains step-by-step instructions (How-Tos) for managing visual pages, custom portal shells, asset configurations, and versions within AppEndO.

---

## 1. How to Open the Component Designer (چطور طراح کامپوننت را باز کنیم)

> **Page**: Admin Portal Workspace · **Role**: `ADMIN` · **Viewport**: Desktop (Tier D)

### Prerequisites (پیش‌نیاز)
- Admin credentials to log in.
- The `studio` mount registration active.

### Steps (مراحل)
1. Navigate to the **Admin Portal** login screen and log in with your credentials.
2. In the left-hand navigation sidebar, look for the **Development** category group.
3. Click on the **Client Components** menu item.
4. You will see a list of existing drafts and built-in system layouts.
5. Click **New Component** (or choose an existing card to open the visual layout canvas).

### Expected Result (نتیجه)
- The main designer workspace opens, loading the toolbox on the left, visual canvas in the center, and the property inspector on the right.

---

## 2. How to Configure Layout Grids & Columns (چطور چیدمان گرید و ستون‌ها را تنظیم کنیم)

> **Page**: Client Components Studio · **Role**: `ADMIN` · **Viewport**: Desktop (Tier D)

### Steps (مراحل)
1. Open the visual design canvas for a component.
2. From the left **Toolbox** sidebar, drag a **Layout Grid** element onto the canvas.
3. Select the newly dropped grid container on the canvas to activate its property settings in the right inspector.
4. In the **Grid Settings** section of the inspector, locate the **Columns Width** field.
5. Enter custom width ratios (for example, type `20% / 70%` or use `1fr 2fr` fractional settings).
6. To make it responsive, toggle the **Breakpoint** selector to **Mobile** and type `100%` (or change direction to vertical stacking).

### Expected Result (نتیجه)
- The columns on the canvas resize instantly to match the custom width ratios. When exported, the compiler writes these settings directly as inline-grid style overrides.

---

## 3. How to Design an App Shell Layout (چطور پوسته اپلیکیشن را طراحی کنیم)

> **Page**: Client Components Studio · **Role**: `ADMIN` · **Viewport**: Desktop (Tier D)

### Steps (مراحل)
1. Open the **Client Components** list page.
2. Click the **Layout Shells** tab on top of the list view.
3. Click **New Shell Layout** to initialize a blank application template.
4. Drag shell components from the toolbox (e.g. **Sidebar**, **Portal Header**, **App Footer**, or **Branded Logo** block) onto the designated slot regions.
5. Select the **Branded Logo** block, and click the file upload icon in the property inspector to upload your corporate brand logo.
6. Click **Save Draft** in the top control bar.

### Expected Result (نتیجه)
- The application layout shell configurations are saved on disk, separating shell boundaries from individual pages.

---

## 4. How to Publish Layouts & Manage Versions (چطور طرح‌ها را منتشر و نسخه‌ها را مدیریت کنیم)

> **Page**: Client Components Studio · **Role**: `ADMIN` · **Viewport**: Desktop (Tier D)

### Steps (مراحل)
1. Inside the designer workspace, make adjustments to your visual canvas layout.
2. Verify that there are no red validation warnings in the status panel.
3. Click the green **Publish** button located in the top-right toolbar.
4. Enter a descriptive version message (e.g., "Updated dashboard statistics layout") in the confirmation dialog and click **Confirm**.
5. To view version logs, click the **Version History** button.
6. To restore a previous draft, select an older version row from the list and click **Rollback**.

### Expected Result (نتیجه)
- Publishing creates a permanent snapshot under `runtime/designer/snapshots/` and locks the active state for client route resolvers.

---

## 5. How to Preview Components with Route Parameters (چطور پیش‌نمایش و پارامترها را بررسی کنیم)

> **Page**: Client Components Studio · **Role**: `ADMIN` · **Viewport**: Desktop / Mobile

### Steps (مراحل)
1. While editing a page component that depends on URL route parameters (like a detailed user form showing information for `:userId`), click the **Preview** button in the designer header.
2. Click **Open in New Tab** to view the runtime page outside the designer frame.
3. In the new tab browser address bar, append the test route query parameters (for example, add `?userId=12`).
4. Press **Enter** to reload the layout preview.

### Expected Result (نتیجه)
- The local preview engine resolves the query bindings dynamically on the backend and binds the data for user ID `12` into the layout field placeholders.

---

## 6. How to Use Undo & Redo (چطور از قابلیت بازگشت تغییرات استفاده کنیم)

> **Page**: Client Components Studio · **Role**: `ADMIN` · **Viewport**: Desktop (Tier D)

### Steps (مراحل)
1. Drag a button widget from the toolbox and place it onto your canvas.
2. Realize you placed it in the wrong slot. Press `Ctrl + Z` on your keyboard (or click the **Undo** arrow in the toolbar).
3. The button disappears, returning the canvas state to the previous frame.
4. If you want to restore it, press `Ctrl + Y` (or click the **Redo** arrow in the toolbar).

### Expected Result (نتیجه)
- Workspace history is tracked in a local memory stack, allowing instant reverts of elements and property changes.
