import { zipSync, strToU8 } from "fflate";
export function fixture() {
  const cells: Record<string, string> = {
    C5: "CLIENTE",
    I5: "VALOR NF(R$)",
    C6: "Cliente teste",
    I6: "1000",
    M6: "OK",
    B95: "1000",
    Q7: "48",
    I56: "Vistoria do carro",
    K56: "71.95",
    I57: "Vistoria do carro",
    K57: "130",
    I58: "Conserto",
    K58: "140",
    C151: "Vistoria do carro",
    F151: "71.95",
    C152: "Vistoria do carro",
    F152: "130",
    C153: "Conserto",
    F153: "140",
    C154: "Almoço",
    F154: "48",
  };
  const rows = new Map<string, string[]>();
  for (const [ref, v] of Object.entries(cells)) {
    const row = ref.replace(/\D/g, "");
    rows.set(row, [
      ...(rows.get(row) || []),
      `<x:c r="${ref}" t="inlineStr"><x:is><x:t>${v}</x:t></x:is></x:c>`,
    ]);
  }
  return zipSync(
    Object.fromEntries(
      Object.entries({
        "xl/workbook.xml":
          '<x:workbook xmlns:x="a" xmlns:r="b"><x:sheets><x:sheet name="OUTUBRO" r:id="r1"/></x:sheets></x:workbook>',
        "xl/_rels/workbook.xml.rels":
          '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": `<x:worksheet xmlns:x="a"><x:sheetData>${[...rows].map(([r, c]) => `<x:row r="${r}">${c.join("")}</x:row>`).join("")}</x:sheetData></x:worksheet>`,
      }).map(([k, v]) => [k, strToU8(v)]),
    ),
  );
}
