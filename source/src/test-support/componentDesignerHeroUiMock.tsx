import React from 'react';

const passthroughDiv = (testId: string) => ({ children, className, ...rest }: any) => (
  <div data-testid={testId} className={className} {...rest}>
    {children}
  </div>
);

export const createComponentDesignerHeroUiMock = () => {
  const Button = ({ children, onPress, isDisabled, className, isIconOnly: _isIconOnly, variant: _variant, ...rest }: any) => (
    <button type="button" onClick={onPress} disabled={Boolean(isDisabled)} className={className} {...rest}>
      {children}
    </button>
  );
  const Chip = ({ children, ...rest }: any) => <span {...rest}>{children}</span>;
  const Badge = ({ children, ...rest }: any) => <span {...rest}>{children}</span>;
  const Kbd = ({ children, ...rest }: any) => <kbd {...rest}>{children}</kbd>;
  const Link = ({ children, ...rest }: any) => <a {...rest}>{children}</a>;
  const Spinner = (props: any) => <span {...props} />;
  const Skeleton = (props: any) => <div {...props} />;
  const Avatar: any = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  Avatar.Fallback = ({ children }: any) => <span>{children}</span>;
  Avatar.Image = (props: any) => <img alt="" {...props} />;
  const Switch: any = ({ children, isDisabled, ...rest }: any) => (
    <label aria-disabled={isDisabled ? 'true' : undefined} {...rest}>{children}</label>
  );
  Switch.Content = ({ children, className }: any) => <span className={className}>{children}</span>;
  Switch.Control = ({ children }: any) => <span>{children}</span>;
  Switch.Thumb = () => <span />;
  const ProgressBar: any = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  ProgressBar.Track = ({ children }: any) => <div>{children}</div>;
  ProgressBar.Fill = () => <div />;
  const Slider: any = ({ children, isDisabled, ...rest }: any) => (
    <div aria-disabled={isDisabled ? 'true' : undefined} {...rest}>{children}</div>
  );
  Slider.Track = ({ children }: any) => <div>{children}</div>;
  Slider.Fill = () => <div />;
  Slider.Thumb = () => <div />;
  const Tooltip: any = ({ children }: any) => <>{children}</>;
  Tooltip.Root = ({ children }: any) => <>{children}</>;
  Tooltip.Trigger = ({ children }: any) => <>{children}</>;
  Tooltip.Content = ({ children }: any) => <>{children}</>;
  const Input = ({ isDisabled, disabled, ...props }: any) => (
    <input disabled={Boolean(isDisabled ?? disabled)} {...props} />
  );
  const TextArea = ({ isDisabled, disabled, ...props }: any) => (
    <textarea disabled={Boolean(isDisabled ?? disabled)} {...props} />
  );
  const Checkbox: any = ({ children, ...rest }: any) => <label {...rest}>{children}</label>;
  Checkbox.Control = ({ children }: any) => <span>{children}</span>;
  Checkbox.Indicator = () => <span />;
  Checkbox.Content = ({ children }: any) => <span>{children}</span>;
  const Select: any = ({ children, isDisabled, disabled, ...rest }: any) => (
    <div aria-disabled={Boolean(isDisabled ?? disabled) ? 'true' : undefined} {...rest}>{children}</div>
  );
  Select.Trigger = ({ children }: any) => <div>{children}</div>;
  Select.Value = () => <span />;
  Select.Indicator = () => <span />;
  Select.Popover = ({ children }: any) => <div>{children}</div>;
  // Bug found while building a full document end-to-end: this mock never exported ComboBox, but
  // UiCombobox.tsx references it unconditionally at module-load time (`ComboBox as any`) — any
  // test that transitively imports the shared/ui barrel (which includes UiCombobox) crashed with
  // "No 'ComboBox' export is defined on the '@heroui/react' mock", independent of whether the
  // specific test actually renders a combobox. Order-dependent: whichever test file happens to
  // import the real (unmocked) module first in a given run populates Vitest's module cache
  // before the gap can be hit, which is why this only manifested in some file-set/run orders.
  const ComboBox: any = ({ children, isDisabled, disabled, ...rest }: any) => (
    <div aria-disabled={Boolean(isDisabled ?? disabled) ? 'true' : undefined} {...rest}>{children}</div>
  );
  ComboBox.InputGroup = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  ComboBox.Trigger = (rest: any) => <button type="button" {...rest} />;
  ComboBox.Popover = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  const ListBox: any = ({ children, ...rest }: any) => <ul {...rest}>{children}</ul>;
  ListBox.Item = ({ children }: any) => <li>{children}</li>;
  const Card: any = passthroughDiv('heroui-card');
  Card.Header = ({ children }: any) => <div>{children}</div>;
  Card.Title = ({ children }: any) => <div>{children}</div>;
  Card.Description = ({ children }: any) => <div>{children}</div>;
  Card.Content = ({ children }: any) => <div>{children}</div>;
  Card.Footer = ({ children }: any) => <div>{children}</div>;
  const Tabs: any = passthroughDiv('heroui-tabs');
  Tabs.ListContainer = ({ children }: any) => <div>{children}</div>;
  Tabs.List = ({ children }: any) => <div>{children}</div>;
  Tabs.Tab = ({ children }: any) => <div>{children}</div>;
  Tabs.Indicator = () => <span />;
  Tabs.Panel = ({ children }: any) => <div>{children}</div>;
  const Accordion: any = passthroughDiv('heroui-accordion');
  Accordion.Item = ({ children }: any) => <div>{children}</div>;
  Accordion.Heading = ({ children }: any) => <div>{children}</div>;
  Accordion.Trigger = ({ children }: any) => <div>{children}</div>;
  Accordion.Indicator = () => <span />;
  Accordion.Panel = ({ children }: any) => <div>{children}</div>;
  const Modal: any = passthroughDiv('heroui-modal');
  Modal.Backdrop = ({ children, onOpenChange, ...rest }: any) => (
    <div
      data-testid="heroui-modal-backdrop"
      data-slot="modal-backdrop"
      onClick={() => onOpenChange?.(false)}
      {...rest}
    >
      {children}
    </div>
  );
  Modal.Container = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  Modal.Dialog = ({ children, ...rest }: any) => <div data-slot="modal-dialog" {...rest}>{children}</div>;
  Modal.Header = ({ children }: any) => <div>{children}</div>;
  Modal.Heading = ({ children }: any) => <div>{children}</div>;
  Modal.Body = ({ children }: any) => <div>{children}</div>;
  const Drawer: any = passthroughDiv('heroui-drawer');
  // Mirrors Modal.Backdrop: production now wraps Drawer.Content in Drawer.Backdrop so the drawer
  // has a dismissable overlay (see runtimeRenderer.tsx heroui.drawer case). Kept "always rendered"
  // like Modal.Backdrop (no isOpen gating) to preserve existing DesignerCanvas edit-mode test behavior.
  Drawer.Backdrop = ({ children, onOpenChange, ...rest }: any) => (
    <div
      data-testid="heroui-drawer-backdrop"
      data-slot="drawer-backdrop"
      onClick={() => onOpenChange?.(false)}
      {...rest}
    >
      {children}
    </div>
  );
  Drawer.Content = ({ children, ...rest }: any) => <div data-slot="drawer-content" {...rest}>{children}</div>;
  Drawer.Dialog = ({ children }: any) => <div>{children}</div>;
  Drawer.Header = ({ children }: any) => <div>{children}</div>;
  Drawer.Heading = ({ children }: any) => <div>{children}</div>;
  Drawer.Body = ({ children }: any) => <div>{children}</div>;
  const Table: any = passthroughDiv('heroui-table');
  Table.ScrollContainer = ({ children }: any) => <div>{children}</div>;
  Table.Content = ({ children }: any) => <div>{children}</div>;
  Table.Header = ({ children }: any) => <div>{children}</div>;
  Table.Column = ({ children }: any) => <div>{children}</div>;
  Table.Body = ({ children }: any) => <div>{children}</div>;
  Table.Row = ({ children }: any) => <div>{children}</div>;
  Table.Cell = ({ children }: any) => <div>{children}</div>;

  const DatePicker: any = ({ children, className, ...rest }: any) => {
    const content = typeof children === 'function'
      ? children({ state: { timeValue: null, setTimeValue: () => {} } })
      : children;

    return (
      <div data-testid="heroui-date-picker" className={className} {...rest}>
        {content}
      </div>
    );
  };
  DatePicker.Trigger = ({ children, className, ...rest }: any) => (
    <button type="button" className={className} {...rest}>{children}</button>
  );
  DatePicker.TriggerIndicator = ({ children }: any) => <span>{children}</span>;
  DatePicker.Popover = ({ children, className }: any) => <div className={className}>{children}</div>;
  const DateField: any = passthroughDiv('date-field');
  DateField.Group = ({ children, className }: any) => <div className={className}>{children}</div>;
  DateField.Input = ({ children, className }: any) => <div className={className}>{typeof children === 'function' ? children({}) : children}</div>;
  DateField.Segment = () => <span />;
  DateField.Suffix = ({ children, className }: any) => <div className={className}>{children}</div>;
  const TimeField: any = passthroughDiv('time-field');
  TimeField.Group = ({ children, className }: any) => <div className={className}>{children}</div>;
  TimeField.Input = ({ children, className }: any) => <div className={className}>{typeof children === 'function' ? children({}) : children}</div>;
  TimeField.Segment = () => <span />;
  const Calendar: any = passthroughDiv('calendar');
  Calendar.Header = ({ children }: any) => <div>{children}</div>;
  Calendar.Heading = () => <span />;
  Calendar.NavButton = () => <button type="button" />;
  Calendar.Grid = ({ children }: any) => <div>{children}</div>;
  Calendar.GridHeader = ({ children }: any) => <div>{typeof children === 'function' ? children('M') : children}</div>;
  Calendar.HeaderCell = ({ children }: any) => <span>{children}</span>;
  Calendar.GridBody = ({ children }: any) => <div>{typeof children === 'function' ? children('2026-07-05') : children}</div>;
  Calendar.Cell = ({ children }: any) => <button type="button">{children}</button>;
  Calendar.YearPickerTrigger = ({ children }: any) => <button type="button">{children}</button>;
  Calendar.YearPickerTriggerHeading = () => <span>2026</span>;
  Calendar.YearPickerTriggerIndicator = () => <span />;
  Calendar.YearPickerGrid = ({ children }: any) => <div>{children}</div>;
  Calendar.YearPickerGridBody = ({ children }: any) => <div>{typeof children === 'function' ? children({ year: 2026 }) : children}</div>;
  Calendar.YearPickerCell = ({ children }: any) => <button type="button">{children}</button>;
  const Label = ({ children, className }: any) => <label className={className}>{children}</label>;
  const DateRangePicker: any = passthroughDiv('heroui-date-range');
  DateRangePicker.Trigger = ({ children }: any) => <div>{children}</div>;
  DateRangePicker.RangeSeparator = ({ children }: any) => <span>{children}</span>;
  DateRangePicker.TriggerIndicator = () => <span />;
  DateRangePicker.Popover = ({ children }: any) => <div>{children}</div>;
  const Autocomplete: any = passthroughDiv('heroui-autocomplete');
  Autocomplete.Trigger = ({ children }: any) => <div>{children}</div>;
  Autocomplete.Value = () => <span />;
  Autocomplete.Indicator = () => <span />;
  Autocomplete.Popover = ({ children }: any) => <div>{children}</div>;
  const Dropdown = passthroughDiv('heroui-dropdown');
  const Breadcrumbs: any = passthroughDiv('heroui-breadcrumbs');
  Breadcrumbs.Item = ({ children, ...rest }: any) => <span {...rest}>{children}</span>;
  const Pagination: any = passthroughDiv('heroui-pagination');
  Pagination.Summary = ({ children }: any) => <div>{children}</div>;
  Pagination.Content = ({ children }: any) => <div>{children}</div>;
  Pagination.Item = ({ children }: any) => <div>{children}</div>;
  Pagination.Link = ({ children }: any) => <div>{children}</div>;
  Pagination.Previous = () => <span />;
  Pagination.Next = () => <span />;
  const RadioGroup = passthroughDiv('heroui-radio-group');
  const Radio: any = passthroughDiv('heroui-radio');
  Radio.Control = ({ children }: any) => <span>{children}</span>;
  Radio.Indicator = () => <span />;
  Radio.Content = ({ children }: any) => <span>{children}</span>;
  const CheckboxGroup = passthroughDiv('heroui-checkbox-group');
  const TagGroup: any = passthroughDiv('heroui-tag-group');
  TagGroup.List = ({ children }: any) => <div>{children}</div>;
  const Tag: any = ({ children }: any) => <span>{children}</span>;
  const Toast: any = passthroughDiv('heroui-toast');
  Toast.Provider = ({ children }: any) => <div data-testid="toast-provider">{children}</div>;
  Toast.Content = ({ children }: any) => <div>{children}</div>;
  Toast.Title = ({ children }: any) => <div>{children}</div>;
  Toast.Description = ({ children }: any) => <div>{children}</div>;
  const toast = Object.assign(
    (message: unknown, options?: Record<string, unknown>) => {
      toast._calls.push({ message, options });
      return `toast-${toast._calls.length}`;
    },
    {
      _calls: [] as Array<{ message: unknown; options?: Record<string, unknown> }>,
      success: (message: unknown, options?: Record<string, unknown>) => toast(message, { ...options, variant: 'success' }),
      danger: (message: unknown, options?: Record<string, unknown>) => toast(message, { ...options, variant: 'danger' }),
      info: (message: unknown, options?: Record<string, unknown>) => toast(message, { ...options, variant: 'accent' }),
      warning: (message: unknown, options?: Record<string, unknown>) => toast(message, { ...options, variant: 'warning' }),
    },
  );
  const Toolbar = passthroughDiv('heroui-toolbar');
  const I18nProvider = ({ children }: any) => <>{children}</>;

  return {
    Button,
    Chip,
    Badge,
    Kbd,
    Link,
    Spinner,
    Skeleton,
    Avatar,
    Switch,
    ProgressBar,
    Slider,
    Tooltip,
    Input,
    TextArea,
    Checkbox,
    Select,
    ComboBox,
    ListBox,
    Card,
    Tabs,
    Accordion,
    Modal,
    Drawer,
    Table,
    DatePicker,
    DateField,
    TimeField,
    Calendar,
    Label,
    DateRangePicker,
    Autocomplete,
    Dropdown,
    Breadcrumbs,
    Pagination,
    RadioGroup,
    Radio,
    CheckboxGroup,
    TagGroup,
    Tag,
    Toast,
    toast,
    Toolbar,
    I18nProvider,
  };
};

export const componentDesignerHeroUiMock = createComponentDesignerHeroUiMock();
