import Alpine from "alpinejs";
import type { AlpineOptionsData } from "../models/Alpine";
import type { Options } from "../models/Options";

Alpine.data(
  "options",
  () =>
    ({
      options: {
        colorIndicator: "begin",
        removeEmptyGroups: true,
      },

      async init() {
        const options = (await browser.storage.sync.get("options")).options;

        if (options !== undefined) {
          this.options = JSON.parse(options as string) as Options;
        }
      },

      async setOptions(
        optionName: keyof Options,
        value: Options[keyof Options]
      ): Promise<void> {
        await browser.storage.sync.set({
          options: JSON.stringify({
            ...this.options,
            [optionName]: value,
          } satisfies Options),
        });
      },
    }) satisfies AlpineOptionsData
);

Alpine.start();
