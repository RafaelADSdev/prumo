import { createCanvas } from "@napi-rs/canvas";
import { zipSync, strToU8 } from "fflate";
import { expect, it } from "vitest";
import { extractAttachment } from "../src/lib/ai/attachments";
import { templateFixture } from "./template-fixture";

const read = (name: string, bytes: string | Uint8Array) =>
  extractAttachment(
    new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], name),
    new AbortController().signal,
  );

function samplePdf(objects: (string | Buffer)[]) {
  const parts = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let length = parts[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      Buffer.from(object),
      Buffer.from("\nendobj\n"),
    ]);
    parts.push(chunk);
    length += chunk.length;
  }
  const xref = offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
    .join("");
  parts.push(
    Buffer.from(
      `xref\n0 ${offsets.length}\n0000000000 65535 f \n${xref}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(parts);
}

function visitPhoto() {
  const canvas = createCanvas(980, 360);
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "black";
  context.font = "bold 58px sans-serif";
  context.fillText("VISITA DO CLIENTE", 65, 130);
  context.fillText("12/11/2039  14:30", 65, 240);
  return canvas;
}

it("extrai Word, CSV com ponto e vírgula, e planilha XLSX com origem", async () => {
  const word = zipSync({
    "word/document.xml": strToU8(
      '<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Instalação</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cliente Ana</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>14:30</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
    ),
  });
  expect((await read("visita.docx", word)).blocks).toEqual([
    { location: "Parágrafo 1", text: "Instalação" },
    { location: "Linha de tabela 1", text: "Cliente Ana | 14:30" },
  ]);
  expect(
    (await read("despesa.csv", 'Descrição;Valor\r\n"Peça, tampa";"25,30"'))
      .blocks[1],
  ).toEqual({
    location: "Linha 2",
    text: '["Peça, tampa","25,30"]',
  });
  const sheet = await read(
    "despesa.xlsx",
    templateFixture([["Despesa", "Peça", "Outros", "25,30"]], true),
  );
  expect(sheet.blocks[1]).toMatchObject({
    uncertain: true,
    text: expect.stringContaining("[fórmula omitida]"),
  });
});

it("extrai texto selecionável do PDF por página", async () => {
  const content = "BT /F1 20 Tf 40 130 Td (Visita do cliente 14:30) Tj ET";
  const pdf = samplePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]);
  expect((await read("visita.pdf", pdf)).blocks).toEqual([
    { location: "Página 1", text: "Visita do cliente 14:30" },
  ]);
});

it("faz OCR de foto e de PDF digitalizado", async () => {
  const canvas = visitPhoto();
  const photo = await read("visita.png", canvas.toBuffer("image/png"));
  expect(photo.blocks[0]).toMatchObject({
    location: "Foto",
    text: expect.stringContaining("14:30"),
  });
  const image = canvas.toBuffer("image/jpeg");
  const content = "q 980 0 0 360 0 0 cm /Im0 Do Q";
  const pdf = samplePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 980 360] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 980 /Height 360 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
      ),
      image,
      Buffer.from("\nendstream"),
    ]),
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]);
  expect((await read("digitalizado.pdf", pdf)).blocks[0]).toMatchObject({
    location: "Página 1",
    text: expect.stringContaining("14:30"),
  });
}, 40_000);

it("recusa fotos ilegíveis, arquivos incompatíveis e planilhas acima do limite", async () => {
  const canvas = createCanvas(280, 160);
  await expect(read("vazio.png", canvas.toBuffer("image/png"))).rejects.toThrow(
    /texto legível/,
  );
  await expect(read("falso.pdf", "texto")).rejects.toThrow(/Não consegui ler/);
  await expect(
    read("longa.csv", "Nome\n" + "Cliente\n".repeat(200)),
  ).rejects.toMatchObject({ status: 413 });
}, 15_000);
