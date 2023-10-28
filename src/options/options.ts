import Alpine from "alpinejs";
import type { ValuesOf } from "../models/common";
import type { AlpineOptionsData } from "../models/Alpine";
import {
  COLOR_INDICATOR_OPTIONS,
  OPTIONS,
  type Options,
} from "../models/Options";
import { type Color, colorsToDots } from "../models/Tabs";
import { EXTENSION_COMMANDS, type ExtensionCommand } from "../models/Commands";
import { getOptions } from "../common";
import {
  ALPINE_DATA_NAMES,
  DEFAULT_SHORTCUT,
  SHORTCUT_KEY_SEPARATOR_REGEXP,
} from "../constants";

Alpine.data(
  ALPINE_DATA_NAMES.OPTIONS,
  () =>
    ({
      options: {
        colorIndicator: COLOR_INDICATOR_OPTIONS.BEGIN,
        removeEmptyGroups: true,
        colors: Object.keys(colorsToDots) as Color[],
      },
      colorsToDots,
      shortcut: DEFAULT_SHORTCUT,

      async init() {
        this.options = await getOptions();

        const commands = await browser.commands.getAll();
        this.shortcut =
          commands
            .find(
              (command) =>
                command.name === EXTENSION_COMMANDS.OPEN_NEW_TAB_IN_GROUP
            )
            ?.shortcut?.split(SHORTCUT_KEY_SEPARATOR_REGEXP) ??
          DEFAULT_SHORTCUT;

        /* eslint-disable-next-line */
        /* @ts-ignore */
        browser.commands.onChanged.addListener((changeInfo) => {
          const commandName = changeInfo.name as ExtensionCommand;
          if (commandName === EXTENSION_COMMANDS.OPEN_NEW_TAB_IN_GROUP) {
            this.shortcut = changeInfo.newShortcut.split(
              SHORTCUT_KEY_SEPARATOR_REGEXP
            );
          }
        });
      },

      isColorDisabled(color: Color): boolean {
        return !this.options.colors.includes(color);
      },

      async setOptions(
        optionName: keyof Options,
        value: ValuesOf<Options>
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

        await this.setOptions(OPTIONS.COLORS, newColors);
      },
    }) satisfies AlpineOptionsData
);

Alpine.start();
