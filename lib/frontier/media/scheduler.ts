export type FrontierMediaPriority = 'visible' | 'near' | 'background';

export type FrontierMediaTask = {
  id: string;
  priority: FrontierMediaPriority;
  run: (signal: AbortSignal) => Promise<void>;
};

function priorityValue(priority: FrontierMediaPriority): number {
  if (priority === 'visible') return 3;
  if (priority === 'near') return 2;
  return 1;
}

/**
 * Tiny cooperative media scheduler shared by image decode and warm video work.
 * It deliberately favors visible work, deduplicates queued tasks, and aborts work
 * as soon as the owning surface leaves the warm viewport.
 */
export class FrontierMediaScheduler {
  private readonly active = new Map<string, AbortController>();
  private queue: FrontierMediaTask[] = [];

  constructor(private readonly concurrency = 4) {}

  enqueue(task: FrontierMediaTask): void {
    this.queue = this.queue.filter((candidate) => candidate.id !== task.id);
    this.queue.push(task);
    this.queue.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority));
    this.pump();
  }

  cancel(id: string): void {
    this.active.get(id)?.abort();
    this.active.delete(id);
    this.queue = this.queue.filter((task) => task.id !== id);
  }

  cancelAll(): void {
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();
    this.queue = [];
  }

  pendingCount(): number {
    return this.queue.length + this.active.size;
  }

  private pump(): void {
    while (this.active.size < this.concurrency && this.queue.length) {
      const task = this.queue.shift();
      if (!task) return;

      const controller = new AbortController();
      this.active.set(task.id, controller);

      void task.run(controller.signal)
        .catch(() => {
          // A failed/cancelled media task is local to the surface. The surface
          // falls back to browser-native media rather than destabilizing the feed.
        })
        .finally(() => {
          if (this.active.get(task.id) === controller) this.active.delete(task.id);
          this.pump();
        });
    }
  }
}
