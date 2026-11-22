import { triggerFileDownload } from "./localDb";

export interface BulkRegistrationRow {
  rowNumber: number;
  reg: string;
  name: string;
  house: string;
  gender: string;
  eventTokens: string[];
  photoFile: string;
  eventIds?: string[];
  picture?: string;
  picturePublicId?: string;
}

export interface RegistrationEvent {
  id: string;
  name: string;
  category: string;
  gender: string;
}

export interface UploadedRegistrationPhoto {
  picture: string;
  publicId: string;
}

export async function downloadRegistrationTemplate(
  events: RegistrationEvent[],
  includeHouse: boolean,
  format: "csv" | "xlsx",
  includeEventsCsv = false,
) {
  const headers = [
    "Register Number",
    "Full Name",
    ...(includeHouse ? ["House"] : []),
    "Gender",
    "Events",
    "Photo File",
  ];
  if (format === "csv") {
    triggerFileDownload(
      `${headers.map(csvCell).join(",")}\r\n`,
      includeHouse
        ? "sportsmeet-admin-registration-template.csv"
        : "sportsmeet-captain-registration-template.csv",
      "text/csv",
    );
    if (includeEventsCsv) downloadEventReference(events);
    return;
  }

  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.utils.book_new();
  const registrationSheet = XLSX.utils.aoa_to_sheet([headers]);
  registrationSheet["!cols"] = headers.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(workbook, registrationSheet, "Registrations");

  const eventSheet = XLSX.utils.aoa_to_sheet([
    ["Event ID", "Event Name", "Category", "Gender"],
    ...events.map((event) => [event.id, event.name, event.category, event.gender]),
  ]);
  eventSheet["!cols"] = [{ wch: 30 }, { wch: 26 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, eventSheet, "Events");

  const instructionSheet = XLSX.utils.aoa_to_sheet([
    ["Bulk registration instructions", "Required format"],
    ["One row per participant. Combine all selected events in one row.", ""],
    ["Register Number", "Required; unique participant identifier."],
    ["Full Name", "Required; participant's full name."],
    ...(includeHouse ? [["House", "Required; must exactly match a configured house."]] : []),
    ["Gender", "Enter Boys or Girls."],
    [
      "Events",
      "Required; separate event IDs or event names with semicolons. Use the Events sheet.",
    ],
    [
      "Photo File",
      "Required for new participants; select this image with the workbook. Its filename must match.",
    ],
    [
      "Photo filename",
      "Name each photo with its register number, e.g. 12345.jpg, or specify the exact filename in Photo File.",
    ],
    ["Athletics limit", "Maximum 3 individual Athletics events per participant, plus 1 relay."],
    [
      "House Athletics limit",
      "Maximum 3 participants per house per individual Athletics event; 4 for a relay.",
    ],
    ["Games", "No per-student event cap; registrations from one house form one house team."],
    [
      "Import behavior",
      "The whole batch is rejected if any row fails validation. Correct errors and upload again.",
    ],
    ["Images", "Images are uploaded to the Cloudinary participant-registration folder."],
  ]);
  instructionSheet["!cols"] = [{ wch: 30 }, { wch: 95 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");

  XLSX.writeFile(
    workbook,
    includeHouse
      ? "sportsmeet-admin-registration-template.xlsx"
      : "sportsmeet-captain-registration-template.xlsx",
  );
}

export async function parseRegistrationWorkbook(file: File): Promise<BulkRegistrationRow[]> {
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    throw new Error("Choose a .csv, .xlsx, or .xls registration file");
  }
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheet = workbook.Sheets.Registrations || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The spreadsheet has no worksheet");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const normalizeHeader = (header: string) =>
    header
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  const rows = rawRows
    .map((row, index) => {
      const values = new Map(
        Object.entries(row).map(([key, value]) => [
          normalizeHeader(key),
          String(value ?? "").trim(),
        ]),
      );
      const get = (...keys: string[]) => keys.map((key) => values.get(key)).find(Boolean) || "";
      const events = get("events", "eventids", "eventnames");
      return {
        rowNumber: index + 2,
        reg: get("registernumber", "regno", "registerno", "reg"),
        name: get("fullname", "studentname", "name"),
        house: get("house", "team"),
        gender: get("gender", "division"),
        eventTokens: events
          .split(/[;\n|]/)
          .map((token) => token.trim())
          .filter(Boolean),
        photoFile: get("photofile", "picturefilename", "photo"),
      };
    })
    .filter(
      (row) =>
        row.reg || row.name || row.house || row.gender || row.eventTokens.length || row.photoFile,
    );

  if (!rows.length) throw new Error("The spreadsheet has no registration rows");
  if (rows.length > 100)
    throw new Error("Upload at most 100 participants per batch; split larger files into batches");
  return rows;
}

export function resolveRegistrationEvents(
  rows: BulkRegistrationRow[],
  events: RegistrationEvent[],
): BulkRegistrationRow[] {
  return rows.map((row) => {
    const ids: string[] = [];
    for (const token of row.eventTokens) {
      const byId = events.find((event) => event.id.toLowerCase() === token.toLowerCase());
      const candidates = byId
        ? [byId]
        : events.filter(
            (event) =>
              event.name.trim().toLowerCase() === token.toLowerCase() &&
              (event.gender === row.gender || event.gender === "Mixed"),
          );
      if (candidates.length !== 1) {
        const detail = candidates.length > 1 ? "is ambiguous; use an Event ID" : "was not found";
        throw new Error(`Spreadsheet row ${row.rowNumber}: event "${token}" ${detail}`);
      }
      if (ids.includes(candidates[0].id)) {
        throw new Error(
          `Spreadsheet row ${row.rowNumber}: event "${token}" is listed more than once`,
        );
      }
      ids.push(candidates[0].id);
    }
    return { ...row, eventIds: ids };
  });
}

export function matchRegistrationPhoto(row: BulkRegistrationRow, files: File[]): File | undefined {
  const basename = (value: string) => value.split(/[\\/]/).pop() || "";
  const requested = basename(row.photoFile).toLowerCase();
  const registrationNumber = row.reg.trim().toLowerCase();
  return files.find((file) => {
    const filename = file.name.toLowerCase();
    const stem = filename.replace(/\.[^.]+$/, "");
    return requested
      ? filename === requested || stem === requested.replace(/\.[^.]+$/, "")
      : stem === registrationNumber;
  });
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Could not read image ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  operation: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const errors: Array<{ index: number; error: unknown }> = [];
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await operation(items[index], index);
      } catch (error) {
        errors.push({ index, error });
      } finally {
        completed += 1;
        onProgress?.(completed);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (errors.length) {
    const error =
      errors[0].error instanceof Error ? errors[0].error : new Error("Image upload failed");
    Object.assign(error, { completedResults: results.filter(Boolean) });
    throw error;
  }
  return results;
}

function downloadEventReference(events: RegistrationEvent[]) {
  const headers = ["Event ID", "Event Name", "Category", "Gender"];
  const rows = events.map((event) => [event.id, event.name, event.category, event.gender]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  triggerFileDownload(`${csv}\r\n`, "sportsmeet-event-reference.csv", "text/csv");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
