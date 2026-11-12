"use client";

import Link from "next/link";
import { canReviewRequest } from "@/lib/permissions/rbac";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GitBranch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  History,
  Inbox,
} from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
import {
  MappingChangeRequest,
  MappingHistoryRecord,
  MappingRequestType,
} from "@/lib/types/domain";

function MappingContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab =
    searchParams.get("tab") === "inbox"
      ? "inbox"
      : searchParams.get("tab") === "history"
        ? "history"
        : "create";
  const preselectedEquipmentId = searchParams.get("equipmentId") || "";
  const preselectedAssetId = searchParams.get("assetId") || "";

  const activeTab = initialTab;
  const setActiveTab = (next: "create" | "inbox" | "history") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "create") params.delete("tab");
    else params.set("tab", next);
    router.push(`/mapping${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assets, setAssets] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [requests, setRequests] = useState<MappingChangeRequest[]>([]);
  const [history, setHistory] = useState<MappingHistoryRecord[]>([]);

  const [requestType, setRequestType] = useState<MappingRequestType>("LINK");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(
    preselectedEquipmentId,
  );
  const [toParentKind, setToParentKind] = useState<
    "ASSET" | "EQUIPMENT" | "UNMAPPED"
  >("ASSET");
  const [toParentId, setToParentId] = useState(preselectedAssetId);
  const [reason, setReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadAll = useCallback(async () => {
    const [resA, resE, resR, resH] = await Promise.all([
      fetch("/api/v1/assets"),
      fetch("/api/v1/equipment"),
      fetch("/api/v1/mapping/requests"),
      fetch("/api/v1/mapping/history"),
    ]);
    const jsonA = await resA.json();
    const jsonE = await resE.json();
    const jsonR = await resR.json();
    const jsonH = await resH.json();

    setAssets(jsonA.data || []);
    setEquipmentList(jsonE.data || []);
    setRequests(
      Array.isArray(jsonR.data) ? jsonR.data : jsonR.data?.requests || [],
    );
    setHistory(
      Array.isArray(jsonH.data) ? jsonH.data : jsonH.data?.history || [],
    );
  }, []);

  useEffect(() => {
    loadAll().catch(() =>
      setFeedback({
        type: "error",
        text: "Data mapping gagal dimuat. Silakan muat ulang halaman.",
      }),
    );
  }, [loadAll]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const effectiveParentKind =
        requestType === "UNLINK"
          ? null
          : toParentKind === "UNMAPPED"
            ? null
            : toParentKind;
      const effectiveParentId =
        requestType === "UNLINK" ? null : toParentId || null;

      const res = await fetch("/api/v1/mapping/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              equipment_id: selectedEquipmentId,
              action_type: requestType,
              to_parent_kind: effectiveParentKind,
              to_parent_id: effectiveParentId,
            },
          ],
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Gagal mengajukan perubahan mapping.",
        });
        return;
      }
      setFeedback({
        type: "success",
        text:
          json.data.status === "APPLIED"
            ? `Perubahan ${json.data.request_code} berhasil diterapkan.`
            : `Pengajuan ${json.data.request_code} dikirim ke Manajer bagian Anda.`,
      });
      setReason("");
      await loadAll();
      setActiveTab(json.data.status === "APPLIED" ? "history" : "inbox");
    } catch {
      setFeedback({
        type: "error",
        text: "Pengajuan gagal dikirim. Periksa koneksi dan coba kembali.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (reqId: string, action: "APPROVE" | "REJECT") => {
    if (busy) return;
    if (action === "REJECT" && !reviewNote.trim()) {
      setFeedback({
        type: "error",
        text: "Isi alasan penolakan terlebih dahulu.",
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/v1/mapping/requests/${reqId}/${action.toLowerCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_note: reviewNote.trim() || "Disetujui oleh peninjau",
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Gagal memproses persetujuan.",
        });
        return;
      }
      setFeedback({
        type: "success",
        text: `Pengajuan ${json.data.request_code} berhasil di-${action === "APPROVE" ? "setujui" : "tolak"}.`,
      });
      setReviewNote("");
      await loadAll();
    } catch {
      setFeedback({
        type: "error",
        text: "Keputusan gagal dikirim. Periksa koneksi dan coba kembali.",
      });
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A3263]">
            Mapping &amp; Hierarki
          </h1>
        </div>

        <Link
          href="/mapping/import"
          className="rounded-lg border bg-white px-3.5 py-2 text-sm font-semibold"
        >
          Import Mapping Awal / Massal
        </Link>
        {/* Tab Selector */}
        <div className="inline-flex rounded-xl bg-white p-1 border border-[#E8E2DB] shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === "create"
                ? "bg-[#1A3263] text-[#FAB95B]"
                : "text-[#547792] hover:text-[#1A3263]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Ajukan Mapping</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === "inbox"
                ? "bg-[#1A3263] text-[#FAB95B]"
                : "text-[#547792] hover:text-[#1A3263]"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox Persetujuan ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === "history"
                ? "bg-[#1A3263] text-[#FAB95B]"
                : "text-[#547792] hover:text-[#1A3263]"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Mapping</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{feedback.text}</span>
        </div>
      )}

      {/* TAB 1: CREATE MAPPING REQUEST */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSubmitRequest}
            className="lg:col-span-2 p-6 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-3">
              Formulir Pengajuan Perubahan Mapping
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {(["LINK", "MOVE", "UNLINK"] as MappingRequestType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRequestType(t)}
                  className={`py-2.5 px-3 rounded-lg font-bold border transition ${
                    requestType === t
                      ? "bg-[#1A3263] text-[#FAB95B] border-[#1A3263]"
                      : "bg-[#F6F4F0] text-[#1A3263] border-[#E8E2DB] hover:bg-[#E8E2DB]/60"
                  }`}
                >
                  {
                    {
                      LINK: "Hubungkan",
                      MOVE: "Pindahkan",
                      UNLINK: "Lepaskan",
                      BATCH: "Massal",
                    }[t]
                  }
                </button>
              ))}
            </div>

            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">
                Pilih Equipment yang Akan Diubah *
              </label>
              <select
                required
                value={selectedEquipmentId}
                onChange={(e) => setSelectedEquipmentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
              >
                <option value="">-- Pilih Equipment --</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.equipment_no} — {eq.name} (Saat ini: {eq.parent_label} |
                    Sub-unit: {eq.child_count})
                  </option>
                ))}
              </select>
            </div>

            {requestType !== "UNLINK" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">
                    Tipe Induk Tujuan *
                  </label>
                  <select
                    value={toParentKind}
                    onChange={(e) => {
                      setToParentKind(e.target.value as "ASSET" | "EQUIPMENT");
                      setToParentId("");
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
                  >
                    <option value="ASSET">
                      Aset SAP (Level 1 di bawah Aset)
                    </option>
                    <option value="EQUIPMENT">
                      Equipment Induk (Sub-Equipment Bertingkat)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">
                    Pilih{" "}
                    {toParentKind === "ASSET"
                      ? "Aset SAP Tujuan"
                      : "Equipment Induk Tujuan"}{" "}
                    *
                  </label>
                  <select
                    required
                    value={toParentId}
                    onChange={(e) => setToParentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
                  >
                    <option value="">-- Pilih Induk Tujuan --</option>
                    {toParentKind === "ASSET"
                      ? assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.sap_asset_no} — {a.name}
                          </option>
                        ))
                      : equipmentList
                          .filter((eq) => eq.id !== selectedEquipmentId)
                          .map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.equipment_no} — {eq.name} (Level {eq.depth})
                            </option>
                          ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">
                Alasan Bisnis / Operasional *
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan alasan pemasangan, relokasi, atau pelepasan equipment..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white font-bold shadow-sm transition"
              >
                <Send className="w-4 h-4 text-[#FAB95B]" />
                <span>Kirim Pengajuan Mapping</span>
              </button>
            </div>
          </form>

          {/* Guidelines Side Card */}
          <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] space-y-3 text-xs h-fit shadow-sm">
            <h3 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
              Panduan Validasi Hierarki
            </h3>
            <ul className="space-y-2.5 text-[#547792] list-disc pl-4">
              <li>
                <b>Induk Tunggal:</b> Setiap equipment hanya memiliki satu induk
                aktif pada satu waktu.
              </li>
              <li>
                <b>Deteksi Siklus:</b> Sistem mencegah pemilihan induk yang
                merupakan turunan dari equipment yang sama.
              </li>
              <li>
                <b>Perpindahan Subtree:</b> Memindahkan equipment induk otomatis
                memindahkan seluruh sub-equipment di bawahnya.
              </li>
              <li>
                <b>Persetujuan Berjenjang:</b> Pemindahan dan pelepasan oleh
                Staff ditinjau Manajer bagiannya. Pengaitan langsung diterapkan.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: INBOX APPROVAL */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          {requests.filter((req) =>
            req.items.some((item) => item.action_type !== "LINK"),
          ).length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-[#E8E2DB] text-center text-xs text-[#547792]">
              Belum ada pengajuan perubahan mapping.
            </div>
          ) : (
            requests
              .filter((req) =>
                req.items.some((item) => item.action_type !== "LINK"),
              )
              .map((req) => (
                <div
                  key={req.id}
                  className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2DB] pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold px-2.5 py-1 rounded bg-[#1A3263] text-[#FAB95B]">
                        {req.request_code}
                      </span>
                      <span className="font-bold px-2.5 py-0.5 rounded bg-[#EDF2F6] text-[#1A3263]">
                        {req.request_type}
                      </span>
                      <span
                        className={`font-bold px-2.5 py-0.5 rounded ${
                          req.status === "SUBMITTED"
                            ? "bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]"
                            : req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-[#547792]">
                      Diajukan oleh{" "}
                      <b className="text-[#1A3263]">{req.requester_name}</b> (
                      {req.requester_role}) pada{" "}
                      {new Date(req.created_at).toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {req.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-[#F6F4F0] border border-[#E8E2DB] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#1A3263] mr-2">
                            {item.equipment_no}
                          </span>
                          <span className="font-bold text-[#1A3263]">
                            {item.equipment_name}
                          </span>
                          {item.descendant_count > 0 && (
                            <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-[#E8EEF7] text-[#1A3263] font-semibold">
                              +{item.descendant_count} sub-equipment ikut
                              berpindah
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[#1A3263]">
                          Induk Awal: <b>{item.from_parent_no || "Unmapped"}</b>{" "}
                          → Induk Tujuan:{" "}
                          <b className="text-[#547792]">
                            {item.to_parent_no || "Unmapped"}
                          </b>{" "}
                          (Aset: {item.to_root_asset_no || "-"})
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[#547792]">
                    <b className="text-[#1A3263]">Alasan Pengajuan:</b>{" "}
                    {req.reason}
                  </div>

                  {req.status === "SUBMITTED" && (
                    <div className="pt-3 border-t border-[#E8E2DB] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {canReviewRequest(user, req) ? (
                        <>
                          <input
                            type="text"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="Catatan persetujuan / penolakan (wajib bila ditolak)..."
                            className="flex-1 px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                          />
                          <div className="flex items-center gap-2">
                            {req.requested_by === user?.id && (
                              <span className="text-[11px] text-[#8A580C] bg-[#FEF6E7] px-2.5 py-1 rounded border border-[#FAB95B] font-semibold">
                                Pengajuan sendiri tidak dapat disetujui oleh
                                akun yang sama
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={busy || req.requested_by === user?.id}
                              onClick={() => handleReview(req.id, "APPROVE")}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Setujui</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy || req.requested_by === user?.id}
                              onClick={() => handleReview(req.id, "REJECT")}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-[#547792] italic">
                          Menunggu peninjauan Manajer bagian atau Administrator.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* TAB 3: MAPPING HISTORY */}
      {activeTab === "history" && (
        <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
              <tr>
                <th className="py-3 px-4 font-bold">Waktu Efektif</th>
                <th className="py-3 px-4 font-bold">Kode CR</th>
                <th className="py-3 px-4 font-bold">Jenis</th>
                <th className="py-3 px-4 font-bold">Equipment</th>
                <th className="py-3 px-4 font-bold">Perubahan Induk</th>
                <th className="py-3 px-4 font-bold">Aset Root</th>
                <th className="py-3 px-4 font-bold">Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2DB]/70">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-[#F6F4F0]/60 transition">
                  <td className="py-3 px-4 text-[#547792] whitespace-nowrap">
                    {new Date(h.occurred_at).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#1A3263]">
                    {h.request_code || "-"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#E8EEF7] text-[#1A3263] font-bold">
                      {h.event_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-[#1A3263] mr-1.5">
                      {h.equipment_no}
                    </span>
                    <span className="text-[#1A3263]">{h.equipment_name}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#1A3263]">
                    {h.from_parent_no || "Unmapped"} →{" "}
                    <b>{h.to_parent_no || "Unmapped"}</b>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#1A3263]">
                    {h.to_asset_no || "-"}
                  </td>
                  <td className="py-3 px-4 text-[#547792]">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MappingPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-[#547792]">
          Memuat workspace mapping...
        </div>
      }
    >
      <MappingContent />
    </Suspense>
  );
}
