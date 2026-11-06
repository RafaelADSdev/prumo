import { chromium } from "playwright";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const browser = await chromium.launch({
  executablePath: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync),
});
try {
  const page = await browser.newPage();
  const css = ["globals", "forms", "experience", "settings", "theme"]
    .map((name) => readFileSync(`src/app/${name}.css`, "utf8"))
    .join("\n");
  for (const theme of ["dark", "light"]) {
    await page.emulateMedia({
      colorScheme: theme === "dark" ? "light" : "dark",
    });
    await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style></head><body>
      <div class="period"><select aria-label="Mês"><option value="all">Ano completo</option><option value="04">Abril</option></select></div>
      <div class="toolbar"><select aria-label="Categoria"><optgroup label="Categorias"><option>Serviços</option></optgroup></select></div>
      <dialog open class="editor-dialog"><select aria-label="Tipo"><option>Entrada</option><option>Saída</option></select></dialog>
    </body></html>`);
    const styles = await page
      .locator("option, optgroup")
      .evaluateAll((elements) =>
        elements.map((el) => {
          const style = getComputedStyle(el);
          return { text: style.color, background: style.backgroundColor };
        }),
      );
    for (const style of styles) {
      assert.notEqual(
        style.background,
        "rgba(0, 0, 0, 0)",
        `${theme}: lista precisa de fundo explícito`,
      );
      const luminance = (color: string) => {
        const rgb = color
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const a = luminance(style.text),
        b = luminance(style.background);
      assert.ok(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
        `${theme}: opções devem ter contraste legível`,
      );
    }
    await page.getByLabel("Mês").selectOption("04");
    assert.equal(await page.getByLabel("Mês").inputValue(), "04");
  }
  console.log(
    "Seletores: contraste das opções e grupos nos dois temas, independente do sistema, e seleção do mês: OK.",
  );
} finally {
  await browser.close();
}
