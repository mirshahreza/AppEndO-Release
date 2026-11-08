export const APPENDOO_EN: Record<string, string> = {
  // ── appendoo.planMode.* ─────────────────────────────────────────────────────
  'appendoo.planMode.ariaLabel': 'Agent plan mode',
  'appendoo.planMode.review.label': 'Review',
  'appendoo.planMode.review.title': 'Review and plan only — no file changes',
  'appendoo.planMode.implement.label': 'Implement',
  'appendoo.planMode.implement.title': 'Implement and draft changes',

  // ── appendoo.chat.* ─────────────────────────────────────────────────────────
  'appendoo.chat.defaultTitle': 'New Chat',
  'appendoo.chat.delete.title': 'Delete chat',
  'appendoo.chat.delete.question': 'Are you sure you want to remove this chat from your history?',
  'appendoo.chat.history.title': 'Chat history',
  'appendoo.chat.history.closeAria': 'Close chat history',
  'appendoo.chat.history.filterPlaceholder': 'Filter chats...',
  'appendoo.chat.history.filterAria': 'Filter chat history',
  'appendoo.chat.history.loading': 'Loading history...',
  'appendoo.chat.history.empty': 'No saved chats yet.',
  'appendoo.chat.history.noFilterMatch': 'No chats match your filter.',
  'appendoo.chat.history.deleteAria': 'Delete {title}',
  'appendoo.chat.history.messageCount': '{count} message',
  'appendoo.chat.history.messageCountPlural': '{count} messages',
  'appendoo.chat.history.tokenTotals': 'In {input} · Out {output}',

  // ── appendoo.companion.* ────────────────────────────────────────────────────
  'appendoo.companion.openAria': 'Open AppEndoo',
  'appendoo.companion.closeAria': 'Close AppEndoo',
  'appendoo.companion.untuckAria': 'Show AppEndoo',

  // ── appendoo.handoff.* ──────────────────────────────────────────────────────
  'appendoo.handoff.summarizeTitle': 'Summarize conversation',
  'appendoo.handoff.createSummary': 'Create summary',
  'appendoo.handoff.replaceOneMessage': 'Replace this chat with a summary from the current model and free context window space.',
  'appendoo.handoff.replaceManyMessages': 'Replace all {count} messages with a summary from the current model and free context window space.',
  'appendoo.handoff.summaryStyle': 'Summary style',
  'appendoo.handoff.summaryStyleAria': 'Summary style',
  'appendoo.handoff.output': 'Output:',
  'appendoo.handoff.modes.fullHandoff.label': 'Full handoff',
  'appendoo.handoff.modes.fullHandoff.description': 'Structured context for continuing this work in a new session.',
  'appendoo.handoff.modes.fullHandoff.resultTitle': 'Conversation Handoff',
  'appendoo.handoff.modes.brief.label': 'Brief summary',
  'appendoo.handoff.modes.brief.description': 'Short overview in a few paragraphs when you only need the gist.',
  'appendoo.handoff.modes.brief.resultTitle': 'Brief Summary',
  'appendoo.handoff.modes.actionItems.label': 'Action items',
  'appendoo.handoff.modes.actionItems.description': 'Next steps, open questions, and blockers only.',
  'appendoo.handoff.modes.actionItems.resultTitle': 'Action Items & Next Steps',
  'appendoo.handoff.modes.technical.label': 'Technical digest',
  'appendoo.handoff.modes.technical.description': 'Decisions, file paths, APIs, and implementation details.',
  'appendoo.handoff.modes.technical.resultTitle': 'Technical Digest',
  'appendoo.handoff.modes.bullet.label': 'Bullet digest',
  'appendoo.handoff.modes.bullet.description': 'Ultra-compact bullet list to save the most context window space.',
  'appendoo.handoff.modes.bullet.resultTitle': 'Bullet Digest',

  // ── appendoo.edit.* ─────────────────────────────────────────────────────────
  'appendoo.edit.title': 'Edit chat',
  'appendoo.edit.description': 'Apply this change to the conversation?',
  'appendoo.edit.deleteMessage': 'Delete message',
  'appendoo.edit.removeSingleMessage': 'Remove only this message from the chat?',
  'appendoo.edit.rewindTitle': 'Rewind to here',
  'appendoo.edit.removeOneAfter': 'Remove 1 message after this point?',
  'appendoo.edit.removeManyAfter': 'Remove {count} messages after this point?',
  'appendoo.edit.deleteFromTitle': 'Delete from here',
  'appendoo.edit.deleteThisMessage': 'Delete this message?',
  'appendoo.edit.deleteThisAndAfter': 'Delete this message and {count} message after it?',
  'appendoo.edit.deleteThisAndAfterPlural': 'Delete this message and {count} messages after it?',

  // ── appendoo.plan.* ─────────────────────────────────────────────────────────
  'appendoo.plan.stepsOne': 'Plan · 1 step',
  'appendoo.plan.stepsMany': 'Plan · {count} steps',
  'appendoo.plan.showDetails': 'Show plan details',
  'appendoo.plan.hideDetails': 'Hide plan details',
  'appendoo.plan.surface': 'Surface:',

  // ── appendoo.taskBreakdown.* ────────────────────────────────────────────────
  'appendoo.taskBreakdown.oneUnit': 'Task breakdown · 1 unit',
  'appendoo.taskBreakdown.manyUnits': 'Task breakdown · {count} units',
  'appendoo.taskBreakdown.title': 'Task breakdown',
  'appendoo.taskBreakdown.assumptions': 'Assumptions',
  'appendoo.taskBreakdown.openQuestions': 'Open questions',
  'appendoo.taskBreakdown.showDetails': 'Show task breakdown details',
  'appendoo.taskBreakdown.hideDetails': 'Hide task breakdown details',

  // ── appendoo.verification.* ─────────────────────────────────────────────────
  'appendoo.verification.passed': 'Post-apply verification passed',
  'appendoo.verification.failed': 'Post-apply verification failed',

  // ── appendoo.tools.* ────────────────────────────────────────────────────────
  'appendoo.tools.readOneFile': 'Read 1 file',
  'appendoo.tools.readManyFiles': 'Read {count} files',
  'appendoo.tools.searchedCodebase': 'Searched codebase',
  'appendoo.tools.searchedCodebaseCount': 'Searched codebase ({count})',
  'appendoo.tools.scannedOnePath': 'Scanned 1 path',
  'appendoo.tools.scannedManyPaths': 'Scanned {count} paths',
  'appendoo.tools.updatedOneFile': 'Updated 1 file',
  'appendoo.tools.updatedManyFiles': 'Updated {count} files',
  'appendoo.tools.oneStepFailed': '1 step failed',
  'appendoo.tools.manyStepsFailed': '{count} steps failed',
  'appendoo.tools.completedWithFailures': 'Completed {success} step, {failed} failed',
  'appendoo.tools.completedWithFailuresPlural': 'Completed {success} steps, {failed} failed',
  'appendoo.tools.completedOneStep': 'Completed 1 step',
  'appendoo.tools.completedManySteps': 'Completed {count} steps',

  // ── appendoo.thinking.* ─────────────────────────────────────────────────────
  'appendoo.thinking.ariaLabel': 'Thinking',
  'appendoo.thinking.label': 'Thinking',
  'appendoo.thinking.done': 'Done',
  'appendoo.thinking.working': 'Working…',
  'appendoo.thinking.showDetails': 'Show thinking details',
  'appendoo.thinking.showCompleted': 'Show completed steps',

  // ── appendoo.message.* ──────────────────────────────────────────────────────
  'appendoo.message.copy': 'Copy message',
  'appendoo.message.edit': 'Edit message',
  'appendoo.message.rewind': 'Rewind to here',
  'appendoo.message.deleteFromHere': 'Delete from here',
  'appendoo.message.deleteThis': 'Delete this message',
  'appendoo.message.copied': 'Message copied',
  'appendoo.message.userActions': 'User message actions',
  'appendoo.message.assistantActions': 'Assistant message actions',
  'appendoo.message.userActionsNamed': '{name} message actions',
  'appendoo.copy.user': 'User',
  'appendoo.copy.assistant': 'Assistant',
  'appendoo.copy.validationPassed': 'Validation passed',
  'appendoo.copy.validationBlocked': 'Validation blocked confirm',

  // ── appendoo.capability.* ───────────────────────────────────────────────────
  'appendoo.capability.chat': 'Chat',
  'appendoo.capability.vision': 'Vision',
  'appendoo.capability.image': 'Image',
  'appendoo.capability.speechToText': 'Speech to text',
  'appendoo.capability.textToSpeech': 'Text to speech',
  'appendoo.capability.tools': 'Tools',

  // ── appendoo.tokenUsage.* ───────────────────────────────────────────────────
  'appendoo.tokenUsage.label': '{tokens} tokens ({percent}% of model context)',
  'appendoo.tokenUsage.summarizeTitle': '{label} — click to summarize conversation',
  'appendoo.tokenUsage.summarizeAria': 'Summarize conversation ({tokens} tokens in current chat)',
  'appendoo.tokenUsage.aria': '{tokens} tokens in current chat',

  // ── appendoo.context.* ──────────────────────────────────────────────────────
  'appendoo.context.addAria': 'Add context',
  'appendoo.context.allAttached': 'All available resources are attached',
  'appendoo.context.resourcesAria': 'Context resources',
  'appendoo.context.removeAria': 'Remove {label} context',

  // ── appendoo.panel.* ────────────────────────────────────────────────────────
  'appendoo.panel.resizeAria': 'Resize chat panel',
  'appendoo.panel.closeChat': 'Close chat',
  'appendoo.panel.undockLeft': 'Undock chat from left',
  'appendoo.panel.dockLeft': 'Dock chat to left',
  'appendoo.panel.undockRight': 'Undock chat from right',
  'appendoo.panel.dockRight': 'Dock chat to right',
  'appendoo.panel.undock': 'Undock',
  'appendoo.panel.restore': 'Restore',
  'appendoo.panel.maximize': 'Maximize',
  'appendoo.panel.restoreWindow': 'Restore chat window',
  'appendoo.panel.maximizeWindow': 'Maximize chat window',
  'appendoo.panel.loadingModels': 'Loading models...',
  'appendoo.panel.noModels': 'No models available',
  'appendoo.panel.changeModel': 'Change model',
  'appendoo.panel.availableModels': 'Available models',
  'appendoo.panel.chatTitle': 'Chat title',
  'appendoo.panel.confirmTitle': 'Confirm title',
  'appendoo.panel.cancelTitleEdit': 'Cancel title edit',
  'appendoo.panel.chatTitleRenameHint': '{title} — double-click to rename',
  'appendoo.panel.newChat': 'New chat',
  'appendoo.panel.chatHistory': 'Chat history',
  'appendoo.panel.emptyTagline': 'Choose a configured model and ask about architecture, payloads, or platform behavior.',
  'appendoo.panel.removeAttachment': 'Remove {name}',

  // ── appendoo.prompt.* ───────────────────────────────────────────────────────
  'appendoo.prompt.ariaLabel': 'Chat prompt',
  'appendoo.prompt.askPlaceholder': 'Ask AppEndO...',
  'appendoo.prompt.queuedOne': '1 message queued…',
  'appendoo.prompt.queuedMany': '{count} messages queued…',
  'appendoo.prompt.addFile': 'Add file',
  'appendoo.prompt.sendMessage': 'Send message',
  'appendoo.prompt.queueMessage': 'Queue message',

  // ── appendoo.mcp.* ──────────────────────────────────────────────────────────
  'appendoo.mcp.warningsTitle': 'MCP connection warnings',

  // ── appendoo.mode.* ───────────────────────────────────────────────────────────
  'appendoo.mode.selectToolsModel': 'Select a model with Tools capability for {mode} mode.',
  'appendoo.mode.plan': 'Plan',
  'appendoo.mode.agent': 'Agent',
  'appendoo.agent.thinking': 'Thinking…',
  'appendoo.agent.startingPlan': 'Starting plan mode…',
  'appendoo.agent.investigating': 'Investigating…',
  'appendoo.agent.starting': 'Starting agent…',

  // ── appendoo.backgroundTask.* ───────────────────────────────────────────────
  'appendoo.backgroundTask.trigger': 'Run in background',
  'appendoo.backgroundTask.queued': "Running in background — you'll get a notification when it's done.",
  'appendoo.backgroundTask.failed': 'Failed to start background task:',

  // ── appendoo.agent.* ────────────────────────────────────────────────────────
  'appendoo.agent.proposalRejected': 'Proposal rejected. Revise your request and try again.',
  'appendoo.agent.planApprovalFailed': 'Plan approval failed.',
  'appendoo.agent.repairRequiresPlan': 'Repair re-execute requires an approved plan binding and open repair revision.',
  'appendoo.agent.repairFailed': 'Repair re-execute failed.',
  'appendoo.agent.rejectFailed': 'Reject changes failed.',
  'appendoo.agent.rejectSummary': 'Changes rejected.',
  'appendoo.agent.zoneRevertFailed': 'Zone revert failed.',
  'appendoo.agent.zoneReverted': 'Diff zone reverted.',
  'appendoo.agent.applyFailed': 'Apply failed.',
  'appendoo.agent.applySuccess': 'Changes applied successfully.',
  'appendoo.agent.readFileFailed': 'Failed to read file.',
};
