import type { AgentMessage } from './types';
import { summarizeHistorySegment } from './contextAssembly';
import { repairToolMessageSequence } from './toolMessageSequence';

export type ContextMemoryActionResult = {
  ok: boolean;
  summary: string;
  prunedCount?: number;
};

export type AgentContextMemoryHandle = {
  summarizeHistory: (maxChars?: number) => ContextMemoryActionResult;
  pruneDuplicateToolObservations: () => ContextMemoryActionResult;
  pruneStaleToolObservations: (maxTurns: number) => ContextMemoryActionResult;
};

type ToolTurnSpan = {
  assistantIndex: number;
  toolIndices: number[];
};

export class AgentContextMemory {
  constructor(private readonly messages: AgentMessage[]) {}

  summarizeHistory(maxChars = 4_000): ContextMemoryActionResult {
    const nonSystem = this.messages.filter((message) => message.role !== 'system');
    if (nonSystem.length < 6) {
      return {
        ok: false,
        summary: 'Not enough conversation history to summarize (need at least 6 messages).',
      };
    }

    const splitAt = Math.max(2, Math.floor(nonSystem.length / 2));
    const historyMessages = nonSystem.slice(0, splitAt);
    const tail = nonSystem.slice(splitAt);
    let summary = summarizeHistorySegment(historyMessages);
    if (summary.length > maxChars) {
      summary = `${summary.slice(0, maxChars)}…`;
    }

    this.messages.splice(
      0,
      this.messages.length,
      { role: 'user', content: `[Earlier conversation summary]\n${summary}` },
      ...tail,
    );

    return {
      ok: true,
      summary: `Summarized ${historyMessages.length} older messages into segment H.`,
      prunedCount: historyMessages.length,
    };
  }

  private collectToolTurnSpans(): ToolTurnSpan[] {
    const turns: ToolTurnSpan[] = [];

    for (let index = 0; index < this.messages.length; index += 1) {
      const message = this.messages[index];
      if (message.role !== 'assistant' || !message.toolCalls?.length) continue;

      const toolIndices: number[] = [];
      let nextIndex = index + 1;
      while (nextIndex < this.messages.length && this.messages[nextIndex].role === 'tool') {
        toolIndices.push(nextIndex);
        nextIndex += 1;
      }

      turns.push({ assistantIndex: index, toolIndices });
      index = nextIndex - 1;
    }

    return turns;
  }

  pruneStaleToolObservations(maxTurns: number): ContextMemoryActionResult {
    if (!Number.isFinite(maxTurns) || maxTurns < 1) {
      return {
        ok: false,
        summary: 'maxTurns must be a positive number.',
      };
    }

    const turns = this.collectToolTurnSpans();
    if (turns.length <= maxTurns) {
      return {
        ok: true,
        summary: 'No stale tool observations to remove.',
        prunedCount: 0,
      };
    }

    const turnsToRemove = turns.slice(0, turns.length - maxTurns);
    const indicesToRemove = new Set<number>();
    for (const turn of turnsToRemove) {
      indicesToRemove.add(turn.assistantIndex);
      for (const toolIndex of turn.toolIndices) {
        indicesToRemove.add(toolIndex);
      }
    }

    let prunedToolCount = 0;
    for (const turn of turnsToRemove) {
      prunedToolCount += turn.toolIndices.length;
    }

    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      if (indicesToRemove.has(index)) {
        this.messages.splice(index, 1);
      }
    }

    this.repairAfterPrune();

    return {
      ok: true,
      summary: prunedToolCount > 0
        ? `Removed ${prunedToolCount} stale tool observation(s) from ${turnsToRemove.length} older turn(s).`
        : 'No stale tool observations to remove.',
      prunedCount: prunedToolCount,
    };
  }

  pruneDuplicateToolObservations(): ContextMemoryActionResult {
    const seen = new Map<string, number>();
    let prunedCount = 0;

    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index];
      if (message.role !== 'tool') continue;

      const key = `${message.name ?? 'tool'}:${message.content.slice(0, 240)}`;
      if (seen.has(key)) {
        this.messages.splice(index, 1);
        prunedCount += 1;
      } else {
        seen.set(key, index);
      }
    }

    this.repairAfterPrune();

    return {
      ok: true,
      summary: prunedCount > 0
        ? `[Output compacted] Removed ${prunedCount} duplicate tool observation(s).`
        : 'No duplicate tool observations found.',
      prunedCount,
    };
  }

  private repairAfterPrune(): void {
    const repaired = repairToolMessageSequence(this.messages);
    this.messages.splice(0, this.messages.length, ...repaired);
  }

  autoPruneToolObservations(maxTurns: number): ContextMemoryActionResult {
    const stale = this.pruneStaleToolObservations(maxTurns);
    const duplicate = this.pruneDuplicateToolObservations();
    const prunedCount = (stale.prunedCount ?? 0) + (duplicate.prunedCount ?? 0);

    return {
      ok: stale.ok && duplicate.ok,
      summary: prunedCount > 0
        ? `[Output compacted] Auto-pruned ${prunedCount} tool observation(s) from context.`
        : 'No tool observations pruned.',
      prunedCount,
    };
  }

  asHandle(): AgentContextMemoryHandle {
    return {
      summarizeHistory: (maxChars) => this.summarizeHistory(maxChars),
      pruneDuplicateToolObservations: () => this.pruneDuplicateToolObservations(),
      pruneStaleToolObservations: (maxTurns) => this.pruneStaleToolObservations(maxTurns),
    };
  }
}
