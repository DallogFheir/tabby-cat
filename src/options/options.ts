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
      shortcut: ["Ctrl", "+", "Shift", "+", "L"],

      async init() {
        const options = await getOptions();
        if (options) {
          this.options = options;
        }

        const commands = await browser.commands.getAll();
        this.shortcut = commands
          .find((command) => command.name === "open-new-tab-in-group")
          ?.shortcut?.split(/(\+)/g) ?? ["Ctrl", "+", "Shift", "+", "L"];

        /* eslint-disable-next-line */
        /* @ts-ignore */
        browser.commands.onChanged.addListener((changeInfo) => {
          if (changeInfo.name === "open-new-tab-in-group") {
            this.shortcut = changeInfo.newShortcut.split(/(\+)/g);
          }
        });
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

      async toggleColor(color: Color): Promise<void> {
        const newColors = this.options.colors.includes(color)
          ? this.options.colors.filter((optionColor) => optionColor !== color)
          : [...this.options.colors, color];

        await this.setOptions("colors", newColors);
      },
    }) satisfies AlpineOptionsData
);

Alpine.start();
