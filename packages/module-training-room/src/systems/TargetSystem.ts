/**
 * Manages interactive targets in the training room.
 * Self-contained — no direct imports from other modules.
 */
export class TargetSystem {
  private score = 0;
  private active = false;

  start(): void {
    this.active = true;
    this.score = 0;
  }

  stop(): void {
    this.active = false;
  }

  hit(): void {
    if (!this.active) return;
    this.score += 10;
  }

  getScore(): number {
    return this.score;
  }
}
