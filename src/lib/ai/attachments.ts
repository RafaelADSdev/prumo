import { createHash } from "node:crypto";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { parse } from "csv-parse/sync";
import { readWorkbook } from "../importer";
import { AiError } from "./errors";
import { maxAttachmentBytes } from "./types";

type Block = { location: string; text: string; uncertain?: boolean };
export type Attachment = { filename: string; hash: string; blocks: Block[] };

const maxText = 48_000;
const maxRows = 200;
const maxPdfPages = 15;
const maxOcrPages = 5;
const maxImageEdge = 2000;
const splitFile = () =>
  new AiError(
    "O documento excede o limite de leitura. Divida o arquivo e envie uma parte por vez.",
    413,
  );
function corrupted(cause?: unknown) {
  const error = new AiError(
    "Não consegui ler o arquivo. Confira se ele está íntegro, legível e no formato indicado.",
  );
  error.cause = cause;
  return error;
}
const modules = path.join(process.cwd(), "node_modules");

function awaitSignal<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

async function withOcr<T>(
  signal: AbortSignal,
  run: (
    recognize: (bytes: Buffer) => Promise<Omit<Block, "location">>,
  ) => Promise<T>,
) {
  let worker: Promise<import("tesseract.js").Worker> | undefined;
  try {
    return await run(async (bytes) => {
      signal.throwIfAborted();
      if (!worker) {
        worker = import("tesseract.js").then(({ createWorker, OEM }) =>
          createWorker("por", OEM.LSTM_ONLY, {
            langPath: path.join(modules, "@tesseract.js-data", "por", "4.0.0"),
            cacheMethod: "none",
            gzip: true,
            errorHandler: () => {},
          }),
        );
      }
      const engine = await awaitSignal(worker, signal);
      const { data } = await awaitSignal(engine.recognize(bytes), signal);
      return { text: data.text, uncertain: data.confidence < 76 };
    });
  } finally {
    if (worker) {
      const finish = worker
        .then((engine) => engine.terminate())
        .catch(() => {});
      if (!signal.aborted) await finish;
    }
  }
}

async function readPhoto(
  bytes: Buffer,
  ext: string,
  signal: AbortSignal,
): Promise<Block[]> {
  const { default: sharp } = await import("sharp");
  const photo = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" });
  const { format, pages } = await photo.metadata();
  if (format !== (ext === "jpg" ? "jpeg" : ext) || (pages ?? 1) !== 1)
    throw corrupted();
  const png = await photo
    .rotate()
    .resize({
      width: maxImageEdge,
      height: maxImageEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#fff" })
    .grayscale()
    .png()
    .toBuffer();
  return withOcr(signal, async (recognize) => [
    { location: "Foto", ...(await recognize(png)) },
  ]);
}

async function readPdf(bytes: Buffer, signal: AbortSignal): Promise<Block[]> {
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")))
    throw corrupted();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const root = path.join(modules, "pdfjs-dist").replaceAll("\\", "/");
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    useWorkerFetch: false,
    cMapUrl: root + "/cmaps/",
    standardFontDataUrl: root + "/standard_fonts/",
    wasmUrl: root + "/wasm/",
    maxImageSize: 25_000_000,
  });
  try {
    const pdf = await awaitSignal(task.promise, signal);
    if (pdf.numPages > maxPdfPages) throw splitFile();
    return await withOcr(signal, async (recognize) => {
      const blocks: Block[] = [];
      let ocrPages = 0;
      let textSize = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        signal.throwIfAborted();
        const page = await awaitSignal(pdf.getPage(number), signal);
        const content = await awaitSignal(page.getTextContent(), signal);
        const text = content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join("")
          .trim();
        const location = "Página " + number;
        if (text) {
          textSize += text.length;
          if (textSize > maxText) throw splitFile();
          blocks.push({ location, text });
        } else {
          if (++ocrPages > maxOcrPages) throw splitFile();
          const { createCanvas } = await import("@napi-rs/canvas");
          const size = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: maxImageEdge / Math.max(size.width, size.height),
          });
          const canvas = createCanvas(
            Math.max(1, Math.ceil(viewport.width)),
            Math.max(1, Math.ceil(viewport.height)),
          );
          const rendering = page.render({
            canvas: canvas as unknown as HTMLCanvasElement,
            viewport,
          });
          const abort = () => rendering.cancel();
          signal.addEventListener("abort", abort, { once: true });
          try {
            await awaitSignal(rendering.promise, signal);
          } finally {
            signal.removeEventListener("abort", abort);
          }
          const result = await recognize(canvas.toBuffer("image/png"));
          textSize += result.text.length;
          if (textSize > maxText) throw splitFile();
          blocks.push({ location, ...result });
        }
        page.cleanup();
      }
      return blocks;
    });
  } finally {
    await task.destroy();
  }
}

type XmlNode = Record<string, XmlNode[] | string>;

function readWord(bytes: Buffer): Block[] {
  let found = false;
  const document = unzipSync(bytes, {
    filter: (item) => {
      if (item.name !== "word/document.xml") return false;
      if (found) throw corrupted();
      found = true;
      if (item.originalSize > 8_000_000) throw splitFile();
      return true;
    },
  })["word/document.xml"];
  if (!document?.length) throw corrupted();
  const xml = strFromU8(document);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw corrupted();
  const parser = new XMLParser({
    preserveOrder: true,
    processEntities: true,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
  });
  const nodes = parser.parse(xml) as XmlNode[];
  const blocks: Block[] = [];
  let paragraphs = 0;
  let rows = 0;
  function textOf(values: XmlNode[], depth = 0): string {
    if (depth > 48) throw corrupted();
    return values
      .map((value) => {
        if (Array.isArray(value.t))
          return value.t
            .map((text) =>
              typeof text["#text"] === "string" ? text["#text"] : "",
            )
            .join("");
        if ("tab" in value || "br" in value) return " ";
        return Object.values(value)
          .filter(Array.isArray)
          .map((children) => textOf(children, depth + 1))
          .join(" ");
      })
      .join("");
  }
  function visit(values: XmlNode[], depth = 0) {
    if (depth > 48) throw corrupted();
    for (const value of values) {
      if (Array.isArray(value.tr)) {
        const text = value.tr
          .filter((child) => Array.isArray(child.tc))
          .map((child) => textOf(child.tc as XmlNode[]))
          .join(" | ");
        blocks.push({ location: "Linha de tabela " + ++rows, text });
      } else if (Array.isArray(value.p)) {
        const text = textOf(value.p);
        if (text.trim())
          blocks.push({ location: "Parágrafo " + ++paragraphs, text });
      } else {
        for (const children of Object.values(value))
          if (Array.isArray(children)) visit(children, depth + 1);
      }
      if (blocks.length > 400) throw splitFile();
    }
  }
  visit(nodes);
  return blocks;
}

function readCsv(bytes: Buffer): Block[] {
  if (bytes.includes(0)) throw corrupted();
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/"(?:[^"]|"")*"/g, "");
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const rows = parse(text, {
    delimiter,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    max_record_size: 16_000,
    to: maxRows + 1,
    info: true,
  }) as unknown as {
    record: string[];
    info: { lines: number };
  }[];
  if (rows.length > maxRows) throw splitFile();
  return rows.map(({ record, info }) => ({
    location: "Linha " + info.lines,
    text: JSON.stringify(record),
  }));
}

function readXlsx(bytes: Buffer): Block[] {
  const sheets = readWorkbook(bytes, 24_000_000);
  if (
    sheets.reduce((count, sheet) => count + Object.keys(sheet.rows).length, 0) >
    maxRows
  )
    throw splitFile();
  return sheets.flatMap((sheet) =>
    Object.entries(sheet.rows).map(([row, cells]) => ({
      location: `${sheet.name.slice(0, 80)} · linha ${row}`,
      text: JSON.stringify(
        Object.fromEntries(
          Object.entries(cells).map(([column, value]) => [
            column,
            sheet.formulas.has(column + row) ? "[fórmula omitida]" : value,
          ]),
        ),
      ),
      uncertain: Object.keys(cells).some((column) =>
        sheet.formulas.has(column + row),
      ),
    })),
  );
}

export async function extractAttachment(
  file: File,
  signal: AbortSignal,
): Promise<Attachment> {
  if (file.size > maxAttachmentBytes) throw splitFile();
  if (!file.size) throw corrupted();
  const filename = file.name.replace(/[\\/\p{Cc}\p{Cf}]/gu, "_").slice(-180);
  const ext = filename.split(".").at(-1)?.toLowerCase() ?? "";
  const bytes = Buffer.from(await file.arrayBuffer());
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(28_000)]);
  try {
    let blocks: Block[];
    if (ext === "pdf") blocks = await readPdf(bytes, timeout);
    else if (ext === "docx") blocks = readWord(bytes);
    else if (ext === "csv") blocks = readCsv(bytes);
    else if (ext === "xlsx") blocks = readXlsx(bytes);
    else if (["jpg", "jpeg", "png", "webp"].includes(ext))
      blocks = await readPhoto(bytes, ext, timeout);
    else
      throw new AiError(
        "Envie um PDF, DOCX, XLSX, CSV ou uma foto JPG, PNG ou WEBP.",
      );
    blocks = blocks
      .map((block) => ({ ...block, text: block.text.trim() }))
      .filter(({ text }) => text.length > 0);
    if (blocks.reduce((size, { text }) => size + text.length, 0) > maxText)
      throw splitFile();
    if (!blocks.length)
      throw new AiError(
        "Não encontrei texto legível. Tente uma foto mais nítida ou envie um arquivo com texto.",
      );
    return {
      filename,
      hash: createHash("sha256").update(bytes).digest("hex"),
      blocks,
    };
  } catch (error) {
    if (timeout.aborted)
      throw new AiError(
        "A leitura demorou demais. Envie menos páginas ou uma foto menor.",
        504,
      );
    if (error instanceof AiError) throw error;
    if (
      error instanceof Error &&
      /^(Planilha descompactada excede|Arquivo interno grande demais)/.test(
        error.message,
      )
    )
      throw splitFile();
    throw corrupted(error);
  }
}
