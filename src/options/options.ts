import Alpine from "alpinejs";
import type { AlpineOptionsData } from "../models/Alpine";
import type { Options } from "../models/Options";
import { type Color, colorsToDots } from "../models/Tabs";
import { getOptions } from "../common";

Alpine.data(
  "options",
  () =>
    ({
      options: {
        colorIndicator: "begin",
        removeEmptyGroups: true,
        saveSessions: true,
        colors: Object.keys(colorsToDots) as Color[],
      },
      colorsToDots,

      async init() {
        const options = await getOptions();

        if (options) {
          this.options = options;
        }
      },

      isColorDisabled(color: Color): boolean {
        return !this.options.colors.includes(color);
      },

      async setOptions(
        optionName: keyof Options,
        value: Options[keyof Options]
      ): Promise<void> {
        const newOptions: Options = {
          ...this.options,
          [optionName]: value,
        };

        await browser.storage.sync.set({
          options: JSON.stringify(newOptions),
        });
        this.options = newOptions;
      },

      async toggleColor(color: Color) {
        const newColors = this.options.colors.includes(color)
          ? this.options.colors.filter((optionColor) => optionColor !== color)
          : [...this.options.colors, color];

        await this.setOptions("colors", newColors);
      },
    }) satisfies AlpineOptionsData
);

Alpine.start();
