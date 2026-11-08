import React from 'react';
import {
  CRUD_SET_CONFIRM_DIALOG_SIZE_LABELS,
  CRUD_SET_CONFIRM_DIALOG_SIZES,
  CRUD_SET_CONFIRM_INITIAL_FOCUS_LABELS,
  CRUD_SET_CONFIRM_INITIAL_FOCUS,
  CRUD_SET_DIALOG_BACKDROP_BLUR_LABELS,
  CRUD_SET_DIALOG_BACKDROP_BLURS,
  CRUD_SET_DIALOG_BACKDROP_TINT_LABELS,
  CRUD_SET_DIALOG_BACKDROP_TINTS,
  CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY_LABELS,
  CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY,
  CRUD_SET_FORM_DIALOG_SIZE_LABELS,
  CRUD_SET_FORM_DIALOG_SIZES,
  CRUD_SET_VIEW_KIND_LABELS,
  CRUD_SET_VIEW_KINDS,
  RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR,
  RECORD_FORM_SIDE_PANEL_BACKGROUND_LABELS,
  RECORD_FORM_SIDE_PANEL_BACKGROUNDS,
  RECORD_FORM_SIDE_PANEL_PLACEMENT_LABELS,
  RECORD_FORM_SIDE_PANEL_PLACEMENTS,
  crudSetDialogBackdropBlur,
  crudSetDialogBackdropTint,
  crudSetDialogBackdropTransparency,
  crudSetDialogCloseOnEscape,
  crudSetDialogComponentName,
  crudSetDialogConfirmInitialFocus,
  crudSetDialogConfirmSize,
  crudSetDialogFormSize,
  crudSetDialogShowCloseButton,
  crudSetDialogShowFooter,
  crudSetDialogShowHeader,
  crudSetDialogSidePanelBackground,
  crudSetDialogSidePanelBackgroundColor,
  crudSetDialogSidePanelPinnable,
  crudSetDialogSidePanelPlacement,
  crudSetDialogSidePanelShowTitle,
  crudSetDialogSidePanelSplitter,
  crudSetDialogSidePanelTitle,
  crudSetDialogSidePanelTitleInHeader,
  crudSetViewKind,
  isCrudSetConfirmDialogSize,
  isCrudSetConfirmInitialFocus,
  isCrudSetDialogBackdropBlur,
  isCrudSetDialogBackdropTint,
  isCrudSetDialogBackdropTransparency,
  isCrudSetFormDialogSize,
  isCrudSetViewKind,
  isRecordFormSidePanelBackground,
  isRecordFormSidePanelPlacement,
  type CrudSetDialogsConfig,
} from '../../domain/component-designer/crudSetSpec';
import { FormField } from './FormSection';
import { CrudSetConfigCheckbox } from './CrudSetConfigCheckbox';
import { UiSelect } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { UiColorPicker } from './UiColorPicker';

export type CrudSetDialogFieldsProps = {
  dialogs: CrudSetDialogsConfig;
  onChange: (next: CrudSetDialogsConfig) => void;
  fieldClassName?: string;
  selectClassName?: string;
};

/** CreateEditModalShell + ConfirmDialogShell chrome for the CRUD Set wizard and living sample. */
export const CrudSetDialogFields: React.FC<CrudSetDialogFieldsProps> = ({
  dialogs,
  onChange,
  fieldClassName,
  selectClassName,
}) => {
  const spec = { dialogs };
  const patch = (partial: Partial<CrudSetDialogsConfig>) => onChange({ ...dialogs, ...partial });

  return (
    <>
      <FormField label="Form dialog size" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogFormSize(spec)}
          onChange={(event) => {
            if (isCrudSetFormDialogSize(event.target.value)) {
              patch({ formSize: event.target.value });
            }
          }}
          ariaLabel="CRUD Set form dialog size"
        >
          {CRUD_SET_FORM_DIALOG_SIZES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_FORM_DIALOG_SIZE_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Confirm dialog size" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogConfirmSize(spec)}
          onChange={(event) => {
            if (isCrudSetConfirmDialogSize(event.target.value)) {
              patch({ confirmSize: event.target.value });
            }
          }}
          ariaLabel="CRUD Set confirm dialog size"
        >
          {CRUD_SET_CONFIRM_DIALOG_SIZES.map((item) => (
            <option key={item} value={item}>{CRUD_SET_CONFIRM_DIALOG_SIZE_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Close button"
        checked={crudSetDialogShowCloseButton(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ showCloseButton: checked })}
      />
      <CrudSetConfigCheckbox
        label="Escape close"
        checked={crudSetDialogCloseOnEscape(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ closeOnEscape: checked })}
      />
      <CrudSetConfigCheckbox
        label="Standard header"
        checked={crudSetDialogShowHeader(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ showHeader: checked })}
      />
      <CrudSetConfigCheckbox
        label="Standard footer"
        checked={crudSetDialogShowFooter(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ showFooter: checked })}
      />
      <FormField label="Confirm initial focus" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogConfirmInitialFocus(spec)}
          onChange={(event) => {
            if (isCrudSetConfirmInitialFocus(event.target.value)) {
              patch({ confirmInitialFocus: event.target.value });
            }
          }}
          ariaLabel="CRUD Set confirm initial focus"
        >
          {CRUD_SET_CONFIRM_INITIAL_FOCUS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_CONFIRM_INITIAL_FOCUS_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Backdrop tint" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogBackdropTint(spec)}
          onChange={(event) => {
            if (isCrudSetDialogBackdropTint(event.target.value)) {
              patch({ backdropTint: event.target.value });
            }
          }}
          ariaLabel="CRUD Set dialog backdrop tint"
        >
          {CRUD_SET_DIALOG_BACKDROP_TINTS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_DIALOG_BACKDROP_TINT_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Backdrop blur" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogBackdropBlur(spec)}
          onChange={(event) => {
            if (isCrudSetDialogBackdropBlur(event.target.value)) {
              patch({ backdropBlur: event.target.value });
            }
          }}
          ariaLabel="CRUD Set dialog backdrop blur"
        >
          {CRUD_SET_DIALOG_BACKDROP_BLURS.map((item) => (
            <option key={item} value={item}>{CRUD_SET_DIALOG_BACKDROP_BLUR_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Backdrop transparency" className={fieldClassName} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogBackdropTransparency(spec)}
          onChange={(event) => {
            if (isCrudSetDialogBackdropTransparency(event.target.value)) {
              patch({ backdropTransparency: event.target.value });
            }
          }}
          ariaLabel="CRUD Set dialog backdrop transparency"
        >
          {CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY.map((item) => (
            <option key={item} value={item}>{CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY_LABELS[item]}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField
        label="Side panel placement"
        hint="Physical left/right, or follow / oppose the theme direction."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogSidePanelPlacement(spec)}
          onChange={(event) => {
            if (isRecordFormSidePanelPlacement(event.target.value)) {
              patch({ sidePanelPlacement: event.target.value });
            }
          }}
          ariaLabel="CRUD Set side panel placement"
        >
          {RECORD_FORM_SIDE_PANEL_PLACEMENTS.map((placement) => (
            <option key={placement} value={placement}>
              {RECORD_FORM_SIDE_PANEL_PLACEMENT_LABELS[placement]}
            </option>
          ))}
        </UiSelect>
      </FormField>
      <CrudSetConfigCheckbox
        label="Pin button"
        checked={crudSetDialogSidePanelPinnable(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ sidePanelPinnable: checked })}
      />
      <CrudSetConfigCheckbox
        label="Splitter"
        checked={crudSetDialogSidePanelSplitter(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ sidePanelSplitter: checked })}
      />
      <FormField
        label="Side panel background"
        hint="Current theme follows the inspector wash (--app-inspector-rail-bg). Specific color uses a hex fill."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetDialogSidePanelBackground(spec)}
          onChange={(event) => {
            if (isRecordFormSidePanelBackground(event.target.value)) {
              patch({ sidePanelBackground: event.target.value });
            }
          }}
          ariaLabel="CRUD Set side panel background"
        >
          {RECORD_FORM_SIDE_PANEL_BACKGROUNDS.map((source) => (
            <option key={source} value={source}>
              {RECORD_FORM_SIDE_PANEL_BACKGROUND_LABELS[source]}
            </option>
          ))}
        </UiSelect>
      </FormField>
      {crudSetDialogSidePanelBackground(spec) === 'custom' ? (
        <FormField label="Side panel color" className={fieldClassName} reserveHintSlot={false}>
          <UiColorPicker
            size="sm"
            variant="popover"
            format="hex"
            showPresets
            value={crudSetDialogSidePanelBackgroundColor(spec)}
            onChange={(sidePanelBackgroundColor) => patch({
              sidePanelBackgroundColor: sidePanelBackgroundColor || RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR,
            })}
            ariaLabel="CRUD Set side panel background color"
          />
        </FormField>
      ) : null}
      <CrudSetConfigCheckbox
        label="Side panel title"
        checked={crudSetDialogSidePanelShowTitle(spec)}
        fieldClassName={fieldClassName}
        selectClassName={selectClassName}
        onChange={(checked) => patch({ sidePanelShowTitle: checked })}
      />
      {crudSetDialogSidePanelShowTitle(spec) ? (
        <>
          <CrudSetConfigCheckbox
            label="Title in header"
            checked={crudSetDialogSidePanelTitleInHeader(spec)}
            fieldClassName={fieldClassName}
            selectClassName={selectClassName}
            onChange={(checked) => patch({ sidePanelTitleInHeader: checked })}
          />
          <FormField
            label="Side panel header"
            hint="Heading on the Edit / View side column (checkboxes and other side-placed fields)."
            className={fieldClassName}
            reserveHintSlot={false}
          >
            <UiInput
              size="sm"
              autoDir={false}
              value={crudSetDialogSidePanelTitle(spec)}
              onChange={(event) => patch({ sidePanelTitle: event.target.value })}
              ariaLabel="CRUD Set side panel header"
            />
          </FormField>
        </>
      ) : null}
      <FormField
        label="Create component"
        hint="Optional Client Components name. Empty generates the form from columns."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiInput
          size="sm"
          autoDir={false}
          value={crudSetDialogComponentName(spec, 'create')}
          onChange={(event) => patch({ createComponent: event.target.value })}
          ariaLabel="CRUD Set create component"
        />
      </FormField>
      <FormField
        label="Edit component"
        hint="Optional designed Edit form. Patches use this. Empty generates from columns."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiInput
          size="sm"
          autoDir={false}
          value={crudSetDialogComponentName(spec, 'edit')}
          onChange={(event) => patch({ editComponent: event.target.value })}
          ariaLabel="CRUD Set edit component"
        />
      </FormField>
      <FormField
        label="View component"
        hint="Optional designed View form (read-only, no submit). Empty generates from columns."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiInput
          size="sm"
          autoDir={false}
          value={crudSetDialogComponentName(spec, 'view')}
          onChange={(event) => patch({ viewComponent: event.target.value })}
          ariaLabel="CRUD Set view component"
        />
      </FormField>
      <FormField
        label="View body"
        hint="Record form, JSON, or a message thread. Used by view row actions."
        className={fieldClassName}
        reserveHintSlot={false}
      >
        <UiSelect
          size="sm"
          className={selectClassName}
          value={crudSetViewKind(spec)}
          onChange={(event) => patch({
            viewKind: isCrudSetViewKind(event.target.value) ? event.target.value : 'record-form',
          })}
          ariaLabel="CRUD Set view body"
        >
          {CRUD_SET_VIEW_KINDS.map((kind) => (
            <option key={kind} value={kind}>{CRUD_SET_VIEW_KIND_LABELS[kind]}</option>
          ))}
        </UiSelect>
      </FormField>
      {crudSetViewKind(spec) === 'json' ? (
        <FormField
          label="JSON field"
          hint="Empty shows the whole row."
          className={fieldClassName}
          reserveHintSlot={false}
        >
          <UiInput
            size="sm"
            autoDir={false}
            value={dialogs.jsonField ?? ''}
            onChange={(event) => patch({ jsonField: event.target.value })}
            ariaLabel="CRUD Set JSON view field"
          />
        </FormField>
      ) : null}
      {crudSetViewKind(spec) === 'thread' ? (
        <>
          <FormField label="Thread items field" className={fieldClassName} reserveHintSlot={false}>
            <UiInput
              size="sm"
              autoDir={false}
              value={dialogs.threadItemsField ?? 'messages'}
              onChange={(event) => patch({ threadItemsField: event.target.value })}
              ariaLabel="CRUD Set thread items field"
            />
          </FormField>
          <FormField label="Thread role field" className={fieldClassName} reserveHintSlot={false}>
            <UiInput
              size="sm"
              autoDir={false}
              value={dialogs.threadRoleField ?? 'role'}
              onChange={(event) => patch({ threadRoleField: event.target.value })}
              ariaLabel="CRUD Set thread role field"
            />
          </FormField>
          <FormField label="Thread body field" className={fieldClassName} reserveHintSlot={false}>
            <UiInput
              size="sm"
              autoDir={false}
              value={dialogs.threadBodyField ?? 'body'}
              onChange={(event) => patch({ threadBodyField: event.target.value })}
              ariaLabel="CRUD Set thread body field"
            />
          </FormField>
        </>
      ) : null}
    </>
  );
};
