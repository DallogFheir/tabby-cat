export class Lock {
  #acquired = false;
  #queue: (() => void)[] = [];

  async acquire() {
    if (!this.#acquired) {
      this.#acquired = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.#queue.push(resolve);
    });
  }

  release() {
    if (!this.#acquired) {
      throw new Error("Lock had not been acquired.");
    }

    if (this.#queue.length === 0) {
      this.#acquired = false;
    } else {
      this.#queue.shift()!();
    }
  }
}
