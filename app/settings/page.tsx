"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { db } from "@/lib/db";
import { resetProgress } from "@/lib/learning";
import { resetSettings, useSettings } from "@/lib/settings";
import { buildBackup, importBackup, markBackupDone, lastBackupAt, daysSince } from "@/lib/backup";
import { useLang, useT } from "@/lib/i18n";
import { Button, PageHeader, Toggle } from "@/components/ui";
import { useDialog } from "@/components/Dialog";
import LanguageSwitch from "@/components/LanguageSwitch";

type TFn = ReturnType<typeof useT>;
type Tab = "general" | "learning" | "data" | "about";

const MINUTES = [10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240, 360, 480, 535];
const TASKS = [4, 6, 8, 10, 12, 16, 20, 30, 40, 60];
const withValue = (list: number[], v: number) => (list.includes(v) ? list : [...list, v].sort((a, b) => a - b));
const select = "rounded-lg border-2 border-ink bg-white px-2 py-1.5 text-sm";

function fmtMin(t: TFn, n: number) {
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return t("unit.min", { n });
  return m === 0 ? t("unit.h", { h }) : t("unit.hm", { h, m });
}

function Section({
  title,
  danger,
  amber,
  children,
}: {
  title: string;
  danger?: boolean;
  amber?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border-2 ${danger ? "border-red-700" : "border-ink"} ${amber ? "bg-amber-retro" : "bg-white"}`}>
      <h2
        className={`rounded-t-[10px] border-b-2 px-4 py-2 font-display text-lg uppercase ${
          danger ? "border-red-700 bg-red-50 text-red-700" : "border-ink bg-sky/40"
        }`}
      >
        {title}
      </h2>
      <div className="divide-y divide-neutral-200 px-4">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {desc && <p className="mt-0.5 text-sm text-neutral-600">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`py-4 text-sm ${className}`}>{children}</div>;
}

export default function SettingsPage() {
  const [s, update] = useSettings();
  const t = useT();
  const lang = useLang();
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>("general");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    setLast(lastBackupAt());
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("tab.general") },
    { id: "learning", label: t("tab.learning") },
    { id: "data", label: t("tab.data") },
    { id: "about", label: t("tab.about") },
  ];

  async function onResetProgress() {
    const yes = await dialog.confirm({
      title: t("reset.confirmTitle"),
      message: t("danger.resetDesc"),
      confirmLabel: t("reset.confirm"),
      danger: true,
    });
    if (!yes) return;
    await resetProgress();
    setMsg(t("reset.done"));
  }

  async function wipe() {
    const word = t("wipe.word");
    const typed = await dialog.prompt({
      title: t("wipe.confirmTitle"),
      message: t("danger.wipeDesc"),
      label: t("wipe.label", { word }),
      placeholder: word,
      expect: word,
      confirmLabel: t("wipe.confirm"),
      danger: true,
    });
    if (typed !== word) return;
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((tb) => tb.clear()));
    });
    resetSettings();
    setMsg(t("wipe.done"));
  }

  async function onExport() {
    const withPdf = await dialog.confirm({
      title: t("backup.pdfTitle"),
      message: t("backup.pdfMsg"),
      confirmLabel: t("backup.pdfYes"),
      cancelLabel: t("backup.pdfNo"),
    });
    try {
      const { json, bytes } = await buildBackup(withPdf);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      markBackupDone();
      setLast(lastBackupAt());
      setMsg(
        t("backup.exported", {
          mb: (bytes / 1024 / 1024).toFixed(2),
          pdf: withPdf ? t("backup.withPdf") : t("backup.noPdf"),
        })
      );
    } catch {
      setMsg(t("backup.exportFail"));
    }
  }

  async function onImportFile(file: File) {
    const yes = await dialog.confirm({
      title: t("backup.restoreTitle"),
      message: t("backup.restoreMsg"),
      confirmLabel: t("backup.restoreYes"),
      danger: true,
    });
    if (!yes) return;
    try {
      const r = await importBackup(await file.text());
      if (r.settings) update(r.settings as Partial<typeof s>);
      setMsg(
        t("backup.restored", { courses: r.counts.courses, tasks: r.counts.tasks, materials: r.counts.materials })
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("backup.restoreFail"));
    }
  }

  const stale = last === null || (typeof last === "number" && daysSince(last) >= 7);

  return (
    <div>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div role="tablist" aria-label={t("settings.title")} className="mt-6 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            id={`tab-${x.id}`}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            aria-controls={`panel-${x.id}`}
            onClick={() => setTab(x.id)}
            className={`rounded-full border-2 border-ink px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === x.id ? "bg-cobalt text-white" : "bg-white hover:bg-sky/40"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5 grid items-start gap-6 lg:grid-cols-2">
        {tab === "general" && (
          <Section title={t("general.interface")}>
            <Row title={t("lang.title")} desc={t("lang.desc")}>
              <LanguageSwitch />
            </Row>
            <Row title={t("motion.title")} desc={t("motion.desc")}>
              <Toggle checked={s.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label={t("motion.title")} />
            </Row>
          </Section>
        )}

        {tab === "learning" && (
          <>
            <Section title={t("learning.session")}>
              <Row title={t("session.time")}>
                <select
                  className={select}
                  value={s.sessionMinutes}
                  onChange={(e) => update({ sessionMinutes: Number(e.target.value) })}
                >
                  {withValue(MINUTES, s.sessionMinutes).map((m) => (
                    <option key={m} value={m}>
                      {fmtMin(t, m)}
                    </option>
                  ))}
                </select>
              </Row>
              <Row title={t("session.tasks")}>
                <select
                  className={select}
                  value={s.sessionTasks}
                  onChange={(e) => update({ sessionTasks: Number(e.target.value) })}
                >
                  {withValue(TASKS, s.sessionTasks).map((n) => (
                    <option key={n} value={n}>
                      {t("unit.task", { n })}
                    </option>
                  ))}
                </select>
              </Row>
              <Note className="text-xs text-neutral-500">{t("session.note")}</Note>
            </Section>

            <Section title={t("learning.celebrate")}>
              <Row title={t("celebrate.every")}>
                <select
                  className={select}
                  value={s.checkpointEvery}
                  onChange={(e) => update({ checkpointEvery: Number(e.target.value) })}
                >
                  {[6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {t("unit.task", { n })}
                    </option>
                  ))}
                </select>
              </Row>
              <Note className="text-xs text-neutral-500">{t("celebrate.note")}</Note>
            </Section>
          </>
        )}

        {tab === "data" && (
          <>
            <Section title={t("data.storage")}>
              <Note className="text-neutral-700">{t("data.privacy")}</Note>
            </Section>

            <Section title={t("backup.title")}>
              <Note>
                {last !== undefined && (
                  <p className={`text-xs ${stale ? "font-semibold text-red-700" : "text-neutral-500"}`}>
                    {last === null
                      ? t("backup.none")
                      : `${t("backup.last", {
                          date: new Date(last).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US"),
                          days: daysSince(last),
                        })}${stale ? " " + t("backup.old") : ""}`}
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onImportFile(file);
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button onClick={onExport}>{t("backup.export")}</Button>
                  <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                    {t("backup.import")}
                  </Button>
                </div>
                {msg && (
                  <p role="status" className="mt-3 text-sm text-neutral-700">
                    {msg}
                  </p>
                )}
              </Note>
            </Section>

            <Section title={t("danger.title")} danger>
              <Row title={t("danger.resetTitle")} desc={t("danger.resetDesc")}>
                <Button variant="ghost" onClick={onResetProgress}>
                  {t("reset.confirm")}
                </Button>
              </Row>
              <Row title={t("danger.wipeTitle")} desc={t("danger.wipeDesc")}>
                <Button variant="ghost" className="text-red-700" onClick={wipe}>
                  {t("wipe.confirm")}
                </Button>
              </Row>
            </Section>
          </>
        )}

        {tab === "about" && (
          <Section title={t("about.title")} amber>
            <Note>{t("about.text")}</Note>
          </Section>
        )}
      </div>
    </div>
  );
}