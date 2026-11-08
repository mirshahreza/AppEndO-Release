import React from 'react';
import { X } from 'lucide-react';
import { FormField } from './FormSection';
import { UiChip } from './UiChip';
import { UiCombobox, type UiComboboxItem } from './UiCombobox';
import { normalizeCatalogTags, parseCatalogTagInput } from '../lib/catalogTags';

export type CatalogTagsFieldProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Previous catalog tags offered in the typeahead. */
  suggestions?: readonly string[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  hint?: string;
  labelExtra?: React.ReactNode;
  className?: string;
};

export type CatalogTagsFieldHandle = {
  /** Commit typed text into tags and return the resulting list. */
  flush: () => string[];
};

/**
 * Catalog tags — Base Components Tags list (UiChip + UiCombobox).
 * Previous tags are suggested after you type (`UiCombobox` `menuTrigger="input"`); press Enter to create a new tag.
 * Inside a native designer dialog the combobox uses an in-tree listbox (no portaled popover).
 */
export const CatalogTagsField = React.forwardRef<CatalogTagsFieldHandle, CatalogTagsFieldProps>(({
  value,
  onChange,
  suggestions = [],
  label = 'Tags',
  placeholder = 'Type a tag and press Enter',
  disabled = false,
  ariaLabel,
  hint,
  labelExtra,
  className,
}, ref) => {
  const [draft, setDraft] = React.useState('');
  const tags = React.useMemo(() => normalizeCatalogTags(value), [value]);
  const selectedKeys = React.useMemo(
    () => new Set(tags.map((tag) => tag.toLowerCase())),
    [tags],
  );

  const resetDraft = React.useCallback(() => {
    setDraft('');
  }, []);

  const addTag = React.useCallback((raw: string): string[] => {
    const nextTag = parseCatalogTagInput(raw);
    if (!nextTag) {
      if (draft) {
        resetDraft();
      }
      return tags;
    }
    const next = normalizeCatalogTags([...tags, nextTag]);
    if (next.length !== tags.length) {
      onChange(next);
    }
    resetDraft();
    return next;
  }, [draft, onChange, resetDraft, tags]);

  React.useImperativeHandle(ref, () => ({
    flush: () => addTag(draft),
  }), [addTag, draft]);

  const removeTag = React.useCallback((tag: string) => {
    onChange(tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  }, [onChange, tags]);

  const suggestionItems = React.useMemo((): UiComboboxItem[] => (
    normalizeCatalogTags([...suggestions])
      .filter((tag) => !selectedKeys.has(tag.toLowerCase()))
      .map((tag) => ({ id: tag, textValue: tag }))
  ), [selectedKeys, suggestions]);

  const fieldAriaLabel = ariaLabel || label || 'Tags';
  const showLabel = Boolean(label);

  const control = (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-visible rounded-[6px] border border-slate-300 bg-white px-2 py-1 shadow-sm"
      role="group"
      aria-label={fieldAriaLabel}
    >
      {tags.map((tag) => (
        <UiChip key={tag.toLowerCase()} size="sm" variant="soft" color="default">
          <span className="inline-flex items-center gap-1">
            {tag}
            {disabled ? null : (
              <button
                type="button"
                tabIndex={-1}
                className="inline-flex rounded p-0.5 text-slate-500 hover:bg-slate-200/80 hover:text-slate-700"
                aria-label={`Remove tag ${tag}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => removeTag(tag)}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            )}
          </span>
        </UiChip>
      ))}
      <div className="relative min-w-[8.5rem] flex-1 self-center overflow-visible">
        <UiCombobox
          size="sm"
          value=""
          items={suggestionItems}
          onChange={(event) => addTag(event.target.value)}
          onInputValueChange={setDraft}
          onCommitInputValue={addTag}
          onBlur={() => {
            if (draft.trim()) {
              addTag(draft);
            }
          }}
          isDisabled={disabled}
          placeholder={placeholder}
          ariaLabel={fieldAriaLabel}
          autoDir={false}
          menuTrigger="input"
          className="!h-7 !min-h-7 !border-0 !shadow-none"
        />
      </div>
    </div>
  );

  if (!showLabel) {
    return <div className={className}>{control}</div>;
  }

  return (
    <FormField
      label={label}
      hint={hint}
      reserveHintSlot={Boolean(hint)}
      labelExtra={labelExtra}
      className={className}
    >
      {control}
    </FormField>
  );
});

CatalogTagsField.displayName = 'CatalogTagsField';
