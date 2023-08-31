import fs from "fs/promises";

const colorsToDots = {
  "#e81224": "🔴",
  "#f7630c": "🟠",
  "#fff100": "🟡",
  "#16c60c": "🟢",
  "#0078d7": "🔵",
  "#886ce4": "🟣",
  "#8e562e": "🟤",
  "#383838": "⚫",
  "#f2f2f2": "⚪",
};

const rules = Object.entries(colorsToDots).map(
  ([color, dot]) =>
    `tab.tabbrowser-tab[label$="${dot}"] vbox.tab-background {\n  background-color: ${color}80 !important;\n  background-image: none !important;\n}`
);

const stylesheet = rules.join("\n\n") + "\n";

fs.writeFile("extra/userChrome.css", stylesheet, "utf-8");
