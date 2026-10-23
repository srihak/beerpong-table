import type { jsPDF } from "jspdf";
import type { RowInput } from "jspdf-autotable";

export type ScheduleRow = {
  round: number;
  tableNumber: number;
  team1Name: string;
  team2Name: string;
  score: string | null;
};

type Rgb = [number, number, number];
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const ROUND_BLUE: Rgb = [99, 174, 251];
const STRIPE_GREY: Rgb = [243, 243, 243];
const LINE_GREY: Rgb = [221, 221, 221];
const TABLE_NUMBER_BLUE: Rgb = [21, 85, 151];
const COLON_ORANGE: Rgb = [255, 65, 0];

const MARGIN = 11;
const CELL_PADDING = { top: 2.4, bottom: 2.4, left: 2, right: 2 };

// Liberation Sans matches Helvetica's metrics and, unlike the built-in PDF
// fonts, covers Czech diacritics
async function addFont(doc: jsPDF, file: string, style: string) {
  const buffer = await (await fetch(`/fonts/${file}`)).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + 0x8000))
    );
  }
  doc.addFileToVFS(file, btoa(binary));
  doc.addFont(file, "LiberationSans", style);
}

function fileSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "turnaj";
}

async function createDoc(options: {
  format: string | number[];
  orientation?: "portrait" | "landscape";
}) {
  // loaded on demand to keep jsPDF out of the page bundle
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "mm", ...options });
  await Promise.all([
    addFont(doc, "LiberationSans-Regular.ttf", "normal"),
    addFont(doc, "LiberationSans-Bold.ttf", "bold"),
  ]);
  return { doc, autoTable };
}

// A4 document in the style of the league's printed schedules
export async function downloadSchedulePdf(
  tournamentName: string,
  schedule: ScheduleRow[]
): Promise<void> {
  const { doc, autoTable } = await createDoc({ format: "a4" });

  // a blue header row per round, followed by one row per table
  const body: RowInput[] = [];
  const roundHeaderRows = new Set<number>();
  schedule.forEach((m, i) => {
    if (i === 0 || schedule[i - 1].round !== m.round) {
      roundHeaderRows.add(body.length);
      body.push([{ content: `${m.round}.kolo`, colSpan: 4 }]);
    }
    body.push([
      String(m.tableNumber),
      m.team1Name,
      m.score ?? ":",
      m.team2Name,
    ]);
  });

  const headerStyles = {
    fillColor: ROUND_BLUE,
    textColor: WHITE,
    fontStyle: "bold" as const,
    fontSize: 9,
  };

  autoTable(doc, {
    margin: MARGIN,
    head: [[{ content: tournamentName, colSpan: 4 }]],
    showHead: "firstPage",
    body,
    theme: "plain",
    rowPageBreak: "avoid",
    styles: {
      font: "LiberationSans",
      fontSize: 10,
      textColor: BLACK,
      halign: "center",
      valign: "middle",
      cellPadding: CELL_PADDING,
      lineColor: LINE_GREY,
      lineWidth: { bottom: 0.25 },
    },
    headStyles: {
      fillColor: BLACK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 9,
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 14.6, fontSize: 8, textColor: TABLE_NUMBER_BLUE },
      1: { cellWidth: 79 },
      2: { cellWidth: 14.6, fontStyle: "bold", textColor: COLON_ORANGE },
      3: { cellWidth: "auto" },
    },
    didParseCell: ({ section, row, cell }) => {
      if (section !== "body") return;
      if (roundHeaderRows.has(row.index)) {
        Object.assign(cell.styles, headerStyles);
        return;
      }
      // stripes alternate across all body rows, round headers included
      cell.styles.fillColor = row.index % 2 === 1 ? STRIPE_GREY : WHITE;
    },
    didDrawCell: ({ section, row, cell }) => {
      // "Hřiště" heads the table-number column, while the round name stays
      // centred across the whole row
      if (section !== "body" || !roundHeaderRows.has(row.index)) return;
      doc.setFont("LiberationSans", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      // autotable centres the full line height, not just the em box
      const lineHeightShift =
        ((doc.getLineHeightFactor() - 1) / 2) * (9 / doc.internal.scaleFactor);
      doc.text(
        "Hřiště",
        cell.x + CELL_PADDING.left,
        cell.y + cell.height / 2 - lineHeightShift,
        { baseline: "middle" }
      );
    },
  });

  doc.save(`rozpis-${fileSlug(tournamentName)}.pdf`);
}
