import React from 'react';
import { cn } from '../../../lib/utils';
import { DesignerCodeEditorField } from '../DesignerFormFields';
import { MONACO_EDITOR_LTR_SHELL_CLASS } from '../monacoEditorLtr';
import { HTML_EDITOR_DEFAULT_HEIGHT } from './types';

export type HtmlSourceEditorProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (html: string) => void;
  editorHeight?: number | string;
  readOnly?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  className?: string;
  trustedHtml?: boolean;
  placeholder?: string;
  ariaLabel?: string;
};

/** Monaco HTML source surface — same shell as `DesignerCodeEditorField` (proven in Studio forms). */
export const HtmlSourceEditor: React.FC<HtmlSourceEditorProps> = ({
  value,
  defaultValue,
  onChange,
  editorHeight = HTML_EDITOR_DEFAULT_HEIGHT,
  readOnly,
  isReadOnly,
  isDisabled = false,
  className,
  placeholder,
  ariaLabel = 'HTML source',
}) => {
  const resolvedReadOnly = readOnly === true || isReadOnly === true || isDisabled;

  return (
    <div
      dir="ltr"
      lang="en"
      className={cn('min-w-0', MONACO_EDITOR_LTR_SHELL_CLASS, className)}
      data-html-editor="true"
      data-html-editor-mode="source"
      data-html-editor-source-only="true"
    >
      <DesignerCodeEditorField
        language="html"
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        editorHeight={editorHeight}
        lineNumbers
        wordWrap
        minimap={false}
        readOnly={resolvedReadOnly}
        isDisabled={isDisabled}
        aiAssist={false}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        className="min-w-0"
      />
    </div>
  );
};
