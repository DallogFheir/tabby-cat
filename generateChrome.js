import fs from "fs/promises";

const hexToRgb = (hexColor) => {
  const rgb = [];

  for (let i = 1; i < 7; i += 2) {
    const hue = parseInt(hexColor.slice(i, i + 2), 16);
    rgb.push(String(hue));
  }

  return rgb.join(", ");
};

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
    `tab.tabbrowser-tab[label$="${dot}"] vbox.tab-background {\n  background-color: rgba(${hexToRgb(
      color
    )}, 80) !important;\n}`
);

const stylesheet =
  "tab.tabbrowser-tab vbox.tab-background {\n  background-image: none !important;\n}\n\n" +
  rules.join("\n\n") +
  "\n";

fs.writeFile("extra/userChrome.css", stylesheet, "utf-8");
