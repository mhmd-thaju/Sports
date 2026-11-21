import { useState } from "react";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: string;
  publicId?: string;
};

async function request<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result as T;
}

export default function MediaUpload() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const login = async () => {
    setMessage(null);
    try {
      const result = await request<{ token: string }>("/media/login", { password });
      setToken(result.token);
      setPassword("");
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not sign in", error: true });
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const newFiles = Array.from(files);
    if (queue.length + newFiles.length > 20) {
      setMessage({ text: "Upload up to 20 photos in each batch.", error: true });
      return;
    }
    if (newFiles.some((file) => !file.type.startsWith("image/") || file.size > 20_000_000)) {
      setMessage({ text: "Choose image files smaller than 20 MB each.", error: true });
      return;
    }
    setMessage(null);
    setQueue((current) => [
      ...current,
      ...newFiles.map((file, index) => ({
        id: `${Date.now()}-${current.length + index}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "Ready",
      })),
    ]);
  };

  const upload = async () => {
    if (!token || busy) return;
    const selected = queue.filter((item) => item.status !== "Published");
    if (!selected.length) {
      setMessage({ text: "Choose photos to upload.", error: true });
      return;
    }

    setBusy(true);
    setMessage(null);
    const newUploads = selected.filter((item) => !item.publicId);
    const uploadedItems = selected.filter((item) => item.publicId);
    const failures: string[] = [];

    try {
      let signatures: Array<{ publicId: string; timestamp: number; folder: string; assetFolder: string; signature: string }> = [];
      let cloudName = "";
      let apiKey = "";
      if (newUploads.length) {
        const signed = await request<{
          cloudName: string;
          apiKey: string;
          uploads: Array<{ publicId: string; timestamp: number; folder: string; assetFolder: string; signature: string }>;
        }>("/media/signatures", { count: newUploads.length }, token);
        signatures = signed.uploads;
        cloudName = signed.cloudName;
        apiKey = signed.apiKey;
      }

      const uploadedById = new Map<string, string>();
      let cursor = 0;
      const worker = async () => {
        while (cursor < newUploads.length) {
          const index = cursor++;
          const item = newUploads[index];
          const signed = signatures[index];
          setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "Uploading..." } : entry));
          try {
            const form = new FormData();
            form.append("file", item.file);
            form.append("api_key", apiKey);
            form.append("timestamp", String(signed.timestamp));
            form.append("folder", signed.folder);
            form.append("asset_folder", signed.assetFolder);
            form.append("public_id", signed.publicId);
            form.append("signature", signed.signature);
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
              method: "POST",
              body: form,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.public_id) {
              throw new Error(result.error?.message || `Cloudinary upload failed (${response.status})`);
            }
            uploadedById.set(item.id, result.public_id);
            setQueue((current) => current.map((entry) =>
              entry.id === item.id ? { ...entry, status: "Uploaded - awaiting publish", publicId: result.public_id } : entry
            ));
          } catch (error) {
            const reason = error instanceof Error ? error.message : "Upload failed";
            failures.push(`${item.file.name}: ${reason}`);
            setQueue((current) => current.map((entry) =>
              entry.id === item.id ? { ...entry, status: `Failed: ${reason}` } : entry
            ));
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(3, newUploads.length) }, () => worker()));
      const uploaded = [
        ...uploadedItems.map((item) => ({ id: item.id, publicId: item.publicId! })),
        ...selected
          .filter((item) => uploadedById.has(item.id))
          .map((item) => ({ id: item.id, publicId: uploadedById.get(item.id)! })),
      ];

      if (uploaded.length) {
        await request("/media/complete", {
          publicIds: uploaded.map((item) => item.publicId),
          caption,
        }, token);
        const publishedIds = new Set(uploaded.map((item) => item.id));
        setQueue((current) => current.map((item) =>
          publishedIds.has(item.id) ? { ...item, status: "Published" } : item
        ));
      }

      setMessage({
        text: uploaded.length
          ? `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} added to the gallery.${failures.length ? ` ${failures.length} upload${failures.length === 1 ? "" : "s"} failed.` : ""}`
          : failures.join(" "),
        error: uploaded.length === 0 || failures.length > 0,
      });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not publish uploaded photos", error: true });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    let logoutError = "";
    try {
      await request("/media/logout", {}, token);
    } catch (error) {
      logoutError = error instanceof Error ? error.message : "The server session could not be revoked";
    }
    queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setToken("");
    setQueue([]);
    setMessage(logoutError ? { text: `Signed out here, but the server session could not be revoked: ${logoutError}`, error: true } : null);
  };

  return (
    <div className="card" style={{ maxWidth: "850px", margin: "0 auto" }}>
      {!token ? (
        <div className="narrow" style={{ margin: "0 auto" }}>
          <h2>Media Team Upload</h2>
          <p className="muted">Sign in with the media-team password to publish event photos.</p>
          <label>
            Upload password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void login();
              }}
            />
          </label>
          {message && <p className={message.error ? "err" : "ok"}>{message.text}</p>}
          <button className="btn" onClick={() => void login()}>Sign in</button>
        </div>
      ) : (
        <>
          <div className="flex-between" style={{ marginBottom: "18px" }}>
            <div>
              <h2>Media Team Upload</h2>
              <p className="muted">Add up to 20 images at a time. Photos are published to the public gallery.</p>
            </div>
            <button className="btn sm ghost" onClick={() => void logout()}>Sign out</button>
          </div>

          <label>
            Choose photos
            <input type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} disabled={busy} />
          </label>
          <label>
            Caption (optional, applies to this batch)
            <input value={caption} onChange={(event) => setCaption(event.target.value)} disabled={busy} />
          </label>

          {queue.length > 0 && (
            <div className="scroll" style={{ margin: "16px 0" }}>
              <table>
                <thead><tr><th>Photo</th><th>File</th><th>Status</th></tr></thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id}>
                      <td><img src={item.previewUrl} alt="" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px" }} /></td>
                      <td>{item.file.name}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {message && <p className={message.error ? "err" : "ok"}>{message.text}</p>}
          <div className="flex-between">
            <button
              className="btn sm ghost"
              disabled={busy || !queue.length}
              onClick={() => setQueue((current) => {
                const retained = current.filter((item) => item.publicId && item.status !== "Published");
                current.filter((item) => !retained.includes(item)).forEach((item) => URL.revokeObjectURL(item.previewUrl));
                return retained;
              })}
            >
              Clear published and unuploaded
            </button>
            <button className="btn" disabled={busy || !queue.some((item) => item.status !== "Published")} onClick={() => void upload()}>
              {busy ? "Uploading..." : "Upload and publish"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
