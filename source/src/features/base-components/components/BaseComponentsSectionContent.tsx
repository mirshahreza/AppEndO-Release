import React from 'react';
import type { BaseComponentsPageModel } from '../hooks/useBaseComponentsPage';
import { ConfirmBaseComponentsWorkspace } from '../confirm/ConfirmBaseComponentsWorkspace';
import { CreateEditBaseComponentsWorkspace } from '../create-edit/CreateEditBaseComponentsWorkspace';
import { DialogBaseComponentsWorkspace } from '../dialog/DialogBaseComponentsWorkspace';
import { FloatingPanelBaseComponentsWorkspace } from '../floating-panel/FloatingPanelBaseComponentsWorkspace';
import { CanvasToolbarBaseComponentsWorkspace } from '../canvas-toolbar/CanvasToolbarBaseComponentsWorkspace';
import { ToolboxPanelBaseComponentsWorkspace } from '../toolbox-panel/ToolboxPanelBaseComponentsWorkspace';
import { SidebarMenuBaseComponentsWorkspace } from '../sidebar-menu/SidebarMenuBaseComponentsWorkspace';
import {
  AiFieldsBaseComponentsWorkspace,
  ChoiceFieldsBaseComponentsWorkspace,
  SelectionFieldsBaseComponentsWorkspace,
  StructuredFieldsBaseComponentsWorkspace,
  TextFieldsBaseComponentsWorkspace,
} from '../form-fields/FormFieldsBaseComponentsWorkspace';
import { AiChatPanelBaseComponentsWorkspace } from '../ai-chat-panel/AiChatPanelBaseComponentsWorkspace';
import { WhereBuilderBaseComponentsWorkspace } from '../where-builder/WhereBuilderBaseComponentsWorkspace';
import { RelationsBaseComponentsWorkspace } from '../relations/RelationsBaseComponentsWorkspace';
import { CrudSetBaseComponentsWorkspace } from '../crud-set/CrudSetBaseComponentsWorkspace';
import { EditViewBaseComponentsWorkspace } from '../edit-view/EditViewBaseComponentsWorkspace';
import { GridBaseComponentsWorkspace } from '../grid/GridBaseComponentsWorkspace';
import { SearchBaseComponentsWorkspace } from '../search/SearchBaseComponentsWorkspace';
import { SurfaceBoxBaseComponentsWorkspace } from '../surface-box/SurfaceBoxBaseComponentsWorkspace';
import { ScrollAreaBaseComponentsWorkspace } from '../scroll-area/ScrollAreaBaseComponentsWorkspace';
import { DockPaneBaseComponentsWorkspace } from '../dock-pane/DockPaneBaseComponentsWorkspace';
import { OrbitBorderBaseComponentsWorkspace } from '../orbit-border/OrbitBorderBaseComponentsWorkspace';
import { OrbitBgBaseComponentsWorkspace } from '../orbit-bg/OrbitBgBaseComponentsWorkspace';
import { ToastBaseComponentsWorkspace } from '../toast/ToastBaseComponentsWorkspace';
import { ToolbarBaseComponentsWorkspace } from '../toolbar/ToolbarBaseComponentsWorkspace';
import { ButtonsBaseComponentsWorkspace } from '../buttons/ButtonsBaseComponentsWorkspace';
import { TreeGridBaseComponentsWorkspace } from '../treegrid/TreeGridBaseComponentsWorkspace';
import { WizardBaseComponentsWorkspace } from '../wizard/WizardBaseComponentsWorkspace';
import { IconSetsBaseComponentsWorkspace } from '../icon-sets/IconSetsBaseComponentsWorkspace';
import { MarkdownEditorBaseComponentsWorkspace } from '../markdown-editor/MarkdownEditorBaseComponentsWorkspace';
import { HtmlEditorBaseComponentsWorkspace } from '../html-editor/HtmlEditorBaseComponentsWorkspace';
import { AvatarBaseComponentsWorkspace } from '../avatar/AvatarBaseComponentsWorkspace';
import { AppendooCompanionBaseComponentsWorkspace } from '../appendoo-companion/AppendooCompanionBaseComponentsWorkspace';
import { ChipBaseComponentsWorkspace } from '../chip/ChipBaseComponentsWorkspace';
import { PhoneNumberBaseComponentsWorkspace } from '../phone-number/PhoneNumberBaseComponentsWorkspace';
import { SkeletonBaseComponentsWorkspace } from '../skeleton/SkeletonBaseComponentsWorkspace';
import { ProgressBaseComponentsWorkspace } from '../progress/ProgressBaseComponentsWorkspace';
import { BreadcrumbsBaseComponentsWorkspace } from '../breadcrumbs/BreadcrumbsBaseComponentsWorkspace';
import { TabsBaseComponentsWorkspace } from '../tabs/TabsBaseComponentsWorkspace';
import { AccordionDisclosureBaseComponentsWorkspace } from '../accordion-disclosure/AccordionDisclosureBaseComponentsWorkspace';
import { PopoverTooltipBaseComponentsWorkspace } from '../popover-tooltip/PopoverTooltipBaseComponentsWorkspace';
import { DateTimeBaseComponentsWorkspace } from '../date-time/DateTimeBaseComponentsWorkspace';
import { FileMediaInputBaseComponentsWorkspace } from '../file-media-input/FileMediaInputBaseComponentsWorkspace';
import { LoadingErrorEmptyBaseComponentsWorkspace } from '../loading-error-empty/LoadingErrorEmptyBaseComponentsWorkspace';
import { ChartBaseComponentsWorkspace } from '../chart/ChartBaseComponentsWorkspace';
import { KanbanBaseComponentsWorkspace } from '../kanban/KanbanBaseComponentsWorkspace';
import { SpreadsheetBaseComponentsWorkspace } from '../spreadsheet/SpreadsheetBaseComponentsWorkspace';
import { ShellFoundationBaseComponentsWorkspace } from '../shell-foundation/ShellFoundationBaseComponentsWorkspace';
import { ShellNavigationBaseComponentsWorkspace } from '../shell-navigation/ShellNavigationBaseComponentsWorkspace';
import { ShellEffectsBaseComponentsWorkspace } from '../shell-effects/ShellEffectsBaseComponentsWorkspace';
import { LandingWidgetsBaseComponentsWorkspace } from '../landing-widgets/LandingWidgetsBaseComponentsWorkspace';
import { MotionBehaviorsBaseComponentsWorkspace } from '../motion-behaviors/MotionBehaviorsBaseComponentsWorkspace';
import { CreativeScenesBaseComponentsWorkspace } from '../creative-scenes/CreativeScenesBaseComponentsWorkspace';
import { VisualEnginesBaseComponentsWorkspace } from '../visual-engines/VisualEnginesBaseComponentsWorkspace';
import { GradientPickerBaseComponentsWorkspace } from '../gradient-picker/GradientPickerBaseComponentsWorkspace';
import { VariableColorPickerBaseComponentsWorkspace } from '../variable-color-picker/VariableColorPickerBaseComponentsWorkspace';
import { BorderShadowPickerBaseComponentsWorkspace } from '../border-shadow-picker/BorderShadowPickerBaseComponentsWorkspace';
import { ColorPickerBaseComponentsWorkspace } from '../color-picker/ColorPickerBaseComponentsWorkspace';
import { TransferListBaseComponentsWorkspace } from '../transfer-list/TransferListBaseComponentsWorkspace';
import { ComponentLayoutBaseComponentsWorkspace } from '../component-layout/ComponentLayoutBaseComponentsWorkspace';
import { ClientComponentBaseComponentsWorkspace } from '../client-component/ClientComponentBaseComponentsWorkspace';
import { MapBaseComponentsWorkspace } from '../map/MapBaseComponentsWorkspace';
import { CodesBaseComponentsWorkspace } from '../codes/CodesBaseComponentsWorkspace';
import { MediaPlayersBaseComponentsWorkspace } from '../media-players/MediaPlayersBaseComponentsWorkspace';
import { PRIMITIVE_SECTION_IDS } from '../catalog/sections/primitiveSections.options';
import { createPrimitiveWorkspace } from '../primitives/PrimitiveBaseComponentsWorkspace';
import type { SectionId } from '../types';

type BaseComponentsSectionContentProps = {
  page: BaseComponentsPageModel;
};

export const BASE_COMPONENT_SECTION_WORKSPACES: Record<SectionId, React.FC> = {
  dialog: DialogBaseComponentsWorkspace,
  'floating-panel': FloatingPanelBaseComponentsWorkspace,
  'canvas-toolbar': CanvasToolbarBaseComponentsWorkspace,
  'toolbox-panel': ToolboxPanelBaseComponentsWorkspace,
  'sidebar-menu': SidebarMenuBaseComponentsWorkspace,
  'create-edit': CreateEditBaseComponentsWorkspace,
  confirm: ConfirmBaseComponentsWorkspace,
  wizard: WizardBaseComponentsWorkspace,
  grid: GridBaseComponentsWorkspace,
  treegrid: TreeGridBaseComponentsWorkspace,
  'crud-set': CrudSetBaseComponentsWorkspace,
  'edit-view': EditViewBaseComponentsWorkspace,
  'text-fields': TextFieldsBaseComponentsWorkspace,
  'choice-fields': ChoiceFieldsBaseComponentsWorkspace,
  'selection-fields': SelectionFieldsBaseComponentsWorkspace,
  'structured-fields': StructuredFieldsBaseComponentsWorkspace,
  'ai-fields': AiFieldsBaseComponentsWorkspace,
  'ai-chat-panel': AiChatPanelBaseComponentsWorkspace,
  'where-builder': WhereBuilderBaseComponentsWorkspace,
  relations: RelationsBaseComponentsWorkspace,
  toolbar: ToolbarBaseComponentsWorkspace,
  buttons: ButtonsBaseComponentsWorkspace,
  search: SearchBaseComponentsWorkspace,
  'surface-box': SurfaceBoxBaseComponentsWorkspace,
  'scroll-area': ScrollAreaBaseComponentsWorkspace,
  'dock-pane': DockPaneBaseComponentsWorkspace,
  toast: ToastBaseComponentsWorkspace,
  'orbit-border': OrbitBorderBaseComponentsWorkspace,
  'orbit-bg': OrbitBgBaseComponentsWorkspace,
  'icon-sets': IconSetsBaseComponentsWorkspace,
  'markdown-editor': MarkdownEditorBaseComponentsWorkspace,
  'html-editor': HtmlEditorBaseComponentsWorkspace,
  avatar: AvatarBaseComponentsWorkspace,
  'appendoo-companion': AppendooCompanionBaseComponentsWorkspace,
  chip: ChipBaseComponentsWorkspace,
  'phone-number': PhoneNumberBaseComponentsWorkspace,
  skeleton: SkeletonBaseComponentsWorkspace,
  progress: ProgressBaseComponentsWorkspace,
  breadcrumbs: BreadcrumbsBaseComponentsWorkspace,
  tabs: TabsBaseComponentsWorkspace,
  'accordion-disclosure': AccordionDisclosureBaseComponentsWorkspace,
  'popover-tooltip': PopoverTooltipBaseComponentsWorkspace,
  'date-time': DateTimeBaseComponentsWorkspace,
  'file-media-input': FileMediaInputBaseComponentsWorkspace,
  'loading-error-empty': LoadingErrorEmptyBaseComponentsWorkspace,
  chart: ChartBaseComponentsWorkspace,
  kanban: KanbanBaseComponentsWorkspace,
  spreadsheet: SpreadsheetBaseComponentsWorkspace,
  'shell-foundation': ShellFoundationBaseComponentsWorkspace,
  'shell-navigation': ShellNavigationBaseComponentsWorkspace,
  'shell-effects': ShellEffectsBaseComponentsWorkspace,
  'landing-widgets': LandingWidgetsBaseComponentsWorkspace,
  'motion-behaviors': MotionBehaviorsBaseComponentsWorkspace,
  'creative-scenes': CreativeScenesBaseComponentsWorkspace,
  'visual-engines': VisualEnginesBaseComponentsWorkspace,
  'color-picker': ColorPickerBaseComponentsWorkspace,
  'variable-color-picker': VariableColorPickerBaseComponentsWorkspace,
  'gradient-picker': GradientPickerBaseComponentsWorkspace,
  'border-shadow-picker': BorderShadowPickerBaseComponentsWorkspace,
  'transfer-list': TransferListBaseComponentsWorkspace,
  'component-layout': ComponentLayoutBaseComponentsWorkspace,
  'client-component': ClientComponentBaseComponentsWorkspace,
  map: MapBaseComponentsWorkspace,
  codes: CodesBaseComponentsWorkspace,
  'media-players': MediaPlayersBaseComponentsWorkspace,
  ...Object.fromEntries(PRIMITIVE_SECTION_IDS.map((id) => [id, createPrimitiveWorkspace(id as SectionId)])),
} as Record<SectionId, React.FC>;

export const BaseComponentsSectionContent: React.FC<BaseComponentsSectionContentProps> = ({ page }) => {
  const Workspace = BASE_COMPONENT_SECTION_WORKSPACES[page.activeSection];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <Workspace />
    </div>
  );
};
