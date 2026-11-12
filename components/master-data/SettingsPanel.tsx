"use client";

import React, { useEffect, useState } from "react";
import { Settings, Save, CheckCircle2 } from "lucide-react";
import { AppSettingsConfig } from "@/lib/types/domain";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettingsConfig | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/v1/admin/settings")
      .then((r) => r.json())
      .then((res) => {
        if (!res.data) throw new Error();
        setSettings(res.data);
      })
      .catch(() =>
        setError("Pengaturan gagal dimuat. Silakan muat ulang halaman."),
      );
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setError("");
    try {
      setSaved(false);
      const res = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      if (json.data) {
        setSettings(json.data);
        setSaved(true);
      }
    } catch {
      setError("Pengaturan gagal disimpan. Silakan coba kembali.");
    } finally {
      setSaving(false);
    }
  };

  if (!settings && error) return <div role="alert">{error}</div>;

  if (!settings) {
    return (
      <div className="text-sm text-[#547792]">Memuat pengaturan sistem...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
          <Settings className="w-6 h-6 text-[#547792]" />
          <span>Pengaturan Tata Kelola Sistem</span>
        </h1>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>Pengaturan berhasil disimpan dan dicatat ke Audit Trail.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Hierarchy Section */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
            1. Kebijakan Hierarki &amp; Persetujuan Mapping
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">
                Batas Kedalaman Maksimum Hierarki
              </label>
              <input
                type="number"
                min={2}
                max={12}
                value={settings.hierarchy.max_depth}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    hierarchy: {
                      ...settings.hierarchy,
                      max_depth: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm text-[#547792]">
              Pengaitan langsung diterapkan. Pemindahan dan pelepasan oleh Staff
              ditinjau Manajer bagiannya.
            </div>
          </div>
        </div>

        {/* Normalization Section */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
            2. Normalisasi Identitas SAP &amp; Equipment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">
                Default Company Code
              </label>
              <input
                type="text"
                value={settings.normalization.default_company_code}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    normalization: {
                      ...settings.normalization,
                      default_company_code: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">
                Default SAP Sub-Number
              </label>
              <input
                type="text"
                value={settings.normalization.default_sub_no}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    normalization: {
                      ...settings.normalization,
                      default_sub_no: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">
                Default Source System Equipment
              </label>
              <input
                type="text"
                value={settings.normalization.default_source_system}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    normalization: {
                      ...settings.normalization,
                      default_source_system: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
              />
            </div>
          </div>
        </div>

        {/* Import & Security */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
            3. Kebijakan Import Excel &amp; Visibilitas Nilai Finansial
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 font-semibold text-[#1A3263]">
              <input
                type="checkbox"
                checked={settings.imports.blank_overwrites}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    imports: {
                      ...settings.imports,
                      blank_overwrites: e.target.checked,
                    },
                  })
                }
              />
              <span>Izinkan sel kosong menimpa nilai lama saat Replace</span>
            </label>

            <label className="flex items-center gap-2 font-semibold text-[#1A3263]">
              <input
                type="checkbox"
                checked={
                  settings.security.maintenance_can_view_financial_values
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    security: {
                      ...settings.security,
                      maintenance_can_view_financial_values: e.target.checked,
                    },
                  })
                }
              />
              <span>
                Izinkan Maintenance melihat nilai perolehan finansial aset
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white font-bold shadow-sm transition"
          >
            <Save className="w-4 h-4 text-[#FAB95B]" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}
