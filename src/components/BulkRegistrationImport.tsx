import { useState } from "react";
import { api } from "../api";
import {
  downloadRegistrationTemplate,
  mapWithConcurrency,
  matchRegistrationPhoto,
  parseRegistrationWorkbook,
  readImageAsDataUrl,
  resolveRegistrationEvents,
  type BulkRegistrationRow,
  type RegistrationEvent,
} from "../bulkRegistration";

interface Props {
  events: RegistrationEvent[];
  houses: string[];
  pin?: string;
  captainPassword?: string;
  captainUsername?: string;
  house?: string;
  onComplete: () => void;
}

interface UploadedPhoto {
  picture: string;
  picturePublicId: string;
}

const normalizeGender = (value: string) => {
  const gender = value.trim().toLowerCase();
  if (gender === "boys" || gender === "boy" || gender === "men") return "Boys";
  if (gender === "girls" || gender === "girl" || gender === "women") return "Girls";
  return value.trim();
};

export default function BulkRegistrationImport({
  events,
  houses,
  pin,
  captainPassword,
  captainUsername,
  house,
  onComplete,
}: Props) {
  const isCaptain = Boolean(captainUsername);
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [rows, setRows] = useState<BulkRegistrationRow[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const credentials = isCaptain
    ? ([captainPassword, captainUsername] as const)
    : ([pin, undefined] as const);
  const endpoint = isCaptain ? "/captain/register-bulk" : "/admin/registration/bulk";

  const downloadTemplate = async (format: "csv" | "xlsx") => {
    try {
      await downloadRegistrationTemplate(events, !isCaptain, format, format === "csv");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not download the registration template",
      );
    }
  };

  const loadSpreadsheet = async (file?: File) => {
    setSpreadsheet(file || null);
    setRows([]);
    setError("");
    setStatus("");
    if (!file) return;
    try {
      const parsed = await parseRegistrationWorkbook(file);
      const normalized = parsed.map((row) => ({ ...row, gender: normalizeGender(row.gender) }));
      setRows(resolveRegistrationEvents(normalized, events));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read the spreadsheet");
    }
  };

  const cleanupPhotos = async (uploaded: UploadedPhoto[]) => {
    const publicIds = [...new Set(uploaded.map((photo) => photo.picturePublicId).filter(Boolean))];
    if (!publicIds.length) return [];
    try {
      const result = await api(
        isCaptain ? "/captain/registration/photos" : "/admin/registration/photos",
        { publicIds },
        credentials[0],
        credentials[1],
        "DELETE",
      );
      return result.warnings || [];
    } catch (reason) {
      return [
        reason instanceof Error
          ? reason.message
          : "Could not clean up unattached participant photos",
      ];
    }
  };

  const importRows = async () => {
    if (!spreadsheet || !rows.length || busy) return;
    setBusy(true);
    setError("");
    setStatus("Checking all rows against current registrations and event limits…");
    const uploaded: UploadedPhoto[] = [];
    try {
      const validatePath = isCaptain
        ? "/captain/register-bulk/validate"
        : "/admin/registration/bulk/validate";
      const validation = await api(
        validatePath,
        {
          rows: rows.map((row) => ({
            rowNumber: row.rowNumber,
            reg: row.reg,
            name: row.name,
            house: house || row.house,
            gender: row.gender,
            eventIds: row.eventIds || [],
          })),
        },
        credentials[0],
        credentials[1],
      );
      const requiredNumbers = new Set<string>(
        (validation.needsPhoto || []).map((reg: string) => reg.trim().toUpperCase()),
      );
      const rowsNeedingPhotos = rows.filter((row) =>
        requiredNumbers.has(row.reg.trim().toUpperCase()),
      );
      const usedFiles = new Set<File>();
      const matched = rowsNeedingPhotos.map((row) => {
        const file = matchRegistrationPhoto(row, photos);
        if (!file)
          throw new Error(
            `Spreadsheet row ${row.rowNumber}: select a photo matching register number ${row.reg}${row.photoFile ? ` or Photo File "${row.photoFile}"` : ""}`,
          );
        if (usedFiles.has(file))
          throw new Error(`Photo ${file.name} is matched to more than one participant`);
        usedFiles.add(file);
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
        if (file.size > 2_500_000) throw new Error(`${file.name} is larger than 2.5 MB`);
        return { row, file };
      });

      setStatus(`Uploading participant photos (0/${matched.length})…`);
      const photoResults = await mapWithConcurrency(
        matched,
        3,
        async ({ file }) => {
          const result = await api(
            isCaptain ? "/captain/registration/photo" : "/admin/registration/photo",
            { picture: await readImageAsDataUrl(file) },
            credentials[0],
            credentials[1],
          );
          if (typeof result.picture !== "string" || typeof result.picturePublicId !== "string") {
            throw new Error("The server returned an invalid participant photo upload result");
          }
          return {
            picture: result.picture,
            picturePublicId: result.picturePublicId,
          };
        },
        (completed) => setStatus(`Uploading participant photos (${completed}/${matched.length})…`),
      );
      uploaded.push(...photoResults);
      const photoByRegisterNumber = new Map(
        matched.map(({ row }, index) => [row.reg.trim().toUpperCase(), photoResults[index]]),
      );
      const result = await api(
        endpoint,
        {
          rows: rows.map((row) => ({
            rowNumber: row.rowNumber,
            reg: row.reg,
            name: row.name,
            house: house || row.house,
            gender: row.gender,
            eventIds: row.eventIds || [],
            ...(photoByRegisterNumber.has(row.reg.trim().toUpperCase())
              ? photoByRegisterNumber.get(row.reg.trim().toUpperCase())
              : {}),
          })),
        },
        credentials[0],
        credentials[1],
      );
      setStatus(
        `Imported ${result.participants} participant(s) across ${result.added} event registration(s).`,
      );
      setSpreadsheet(null);
      setPhotos([]);
      setRows([]);
      onComplete();
    } catch (reason) {
      const partial = reason as Error & { completedResults?: UploadedPhoto[] };
      if (partial.completedResults) uploaded.push(...partial.completedResults);
      const cleanupWarnings = await cleanupPhotos(uploaded);
      const message = reason instanceof Error ? reason.message : "Bulk registration failed";
      setError(
        cleanupWarnings.length
          ? `${message}. Cleanup warning: ${cleanupWarnings.join("; ")}`
          : message,
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: "20px" }}>
      <h3>Bulk registration</h3>
      <p className="muted">
        Import 1–100 participants from CSV or Excel. The server validates the entire batch before
        committing anything. Select photos separately; files should be named with each register
        number or match the spreadsheet’s Photo File column.
      </p>
      <div className="flex-gap" style={{ flexWrap: "wrap", marginBottom: "16px" }}>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => void downloadTemplate("xlsx")}
        >
          Download Excel template
        </button>
        <button type="button" className="btn sm ghost" onClick={() => void downloadTemplate("csv")}>
          Download CSV template
        </button>
      </div>
      <div
        className="legacy-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        <label>
          Registration spreadsheet
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={busy}
            onChange={(event) => void loadSpreadsheet(event.target.files?.[0])}
          />
        </label>
        <label>
          Participant photos
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(event) => setPhotos(Array.from(event.target.files || []))}
          />
        </label>
      </div>
      {rows.length > 0 && (
        <p className="muted">
          {rows.length} participant row(s) loaded.{" "}
          {house
            ? `All participants will be registered for ${house}.`
            : `Configured houses: ${houses.join(", ")}.`}
        </p>
      )}
      {rows.length > 0 && (
        <div className="scroll" style={{ maxHeight: "280px", marginBottom: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Spreadsheet row</th>
                <th>Register number</th>
                <th>Participant</th>
                <th>House</th>
                <th>Division</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{row.reg}</td>
                  <td>{row.name}</td>
                  <td>{house || row.house}</td>
                  <td>{row.gender}</td>
                  <td>
                    {(row.eventIds || [])
                      .map((id) => events.find((event) => event.id === id)?.name || id)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="err">{error}</p>}
      {status && <p className="muted">{status}</p>}
      <button
        type="button"
        className="btn"
        disabled={!spreadsheet || !rows.length || busy}
        onClick={() => void importRows()}
      >
        {busy ? "Importing…" : "Validate and import all"}
      </button>
    </section>
  );
}
