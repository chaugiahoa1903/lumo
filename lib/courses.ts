import { db } from "./db";
import { splitText, type SplitResult } from "./splitter";

export async function createCourseFromMaterial(
  materialId: number,
  wordsPerMinute: number
): Promise<{ courseId: number; stats: SplitResult["stats"] }> {
  const m = await db.materials.get(materialId);
  if (!m) throw new Error("Không tìm thấy tài liệu.");
  if (m.type === "link") {
    throw new Error("Hiện Luna chưa chia được link. Hãy dùng ghi chú hoặc PDF có chữ chọn được.");
  }
  const text = (m.content ?? "").trim();
  if (!text) throw new Error("Ghi chú đang trống, chưa có gì để chia.");

  const wpm = Math.min(300, Math.max(60, Math.round(wordsPerMinute) || 100));
  const res = splitText(text, { wordsPerMinute: wpm, structured: m.type === "pdf", moduleBy: "chapter", choiceCards: true });
  if (res.modules.length === 0) throw new Error("Luna không tách được nội dung nào.");

  const courseId = await db.transaction("rw", [db.courses, db.modules, db.tasks], async () => {
    const cid = await db.courses.add({
      title: m.title,
      materialIds: [m.id],
      wordsPerMinute: wpm,
      createdAt: Date.now(),
    });
    let order = 0;
    for (let mi = 0; mi < res.modules.length; mi++) {
      const dm = res.modules[mi];
      const mid = await db.modules.add({ courseId: cid, title: dm.title, order: mi, reason: dm.reason });
      for (const t of dm.tasks) {
        await db.tasks.add({
          courseId: cid,
          moduleId: mid,
          order: order++,
          type: t.type,
          title: t.title,
          estMinutes: t.estMinutes,
          status: "todo",
          isMilestone: t.isMilestone,
          materialId: m.id,
          reason: t.reason,
          teaser: t.teaser,
          body: t.body,
          answer: t.answer,
          keywords: t.keywords,
          options: t.options,
          correct: t.correct,
          difficulty: t.difficulty,
        });
      }
    }
    return cid;
  });

  return { courseId, stats: res.stats };
}

// Task cuối mỗi module luôn là milestone
async function normalizeMilestones(courseId: number) {
  const mods = await db.modules.where("courseId").equals(courseId).toArray();
  for (const md of mods) {
    const ts = (await db.tasks.where("moduleId").equals(md.id).toArray()).sort((a, b) => a.order - b.order);
    for (let i = 0; i < ts.length; i++) {
      const want = i === ts.length - 1;
      if (ts[i].isMilestone !== want) await db.tasks.update(ts[i].id, { isMilestone: want });
    }
  }
}

export async function deleteCourse(courseId: number) {
  await db.transaction("rw", [db.courses, db.modules, db.tasks], async () => {
    await db.tasks.where("courseId").equals(courseId).delete();
    await db.modules.where("courseId").equals(courseId).delete();
    await db.courses.delete(courseId);
  });
}

export async function renameModule(id: number, title: string) {
  const t = title.trim();
  if (t) await db.modules.update(id, { title: t });
}

export async function renameTask(id: number, title: string) {
  const t = title.trim();
  if (t) await db.tasks.update(id, { title: t });
}

export async function deleteTask(id: number) {
  await db.transaction("rw", [db.modules, db.tasks], async () => {
    const t = await db.tasks.get(id);
    if (!t) return;
    await db.tasks.delete(id);
    const left = await db.tasks.where("moduleId").equals(t.moduleId).count();
    if (left === 0) await db.modules.delete(t.moduleId);
    await normalizeMilestones(t.courseId);
  });
}

export async function deleteModule(id: number) {
  await db.transaction("rw", [db.modules, db.tasks], async () => {
    await db.tasks.where("moduleId").equals(id).delete();
    await db.modules.delete(id);
  });
}

export async function mergeWithNext(moduleId: number) {
  await db.transaction("rw", [db.modules, db.tasks], async () => {
    const m = await db.modules.get(moduleId);
    if (!m) return;
    const mods = await db.modules.where("courseId").equals(m.courseId).sortBy("order");
    const idx = mods.findIndex((x) => x.id === moduleId);
    const next = mods[idx + 1];
    if (!next) return;
    await db.tasks.where("moduleId").equals(next.id).modify({ moduleId: m.id });
    await db.modules.delete(next.id);
    await normalizeMilestones(m.courseId);
  });
}

// Tách module: task này và các task sau nó thành module mới
export async function splitModuleAt(taskId: number) {
  await db.transaction("rw", [db.modules, db.tasks], async () => {
    const t = await db.tasks.get(taskId);
    if (!t) return;
    const md = await db.modules.get(t.moduleId);
    if (!md) return;
    const ts = (await db.tasks.where("moduleId").equals(md.id).toArray()).sort((a, b) => a.order - b.order);
    const idx = ts.findIndex((x) => x.id === taskId);
    if (idx <= 0) return;
    await db.modules
      .where("courseId")
      .equals(md.courseId)
      .and((x) => x.order > md.order)
      .modify((x) => {
        x.order += 1;
      });
    const newId = await db.modules.add({
      courseId: md.courseId,
      title: `${md.title} (tiếp)`,
      order: md.order + 1,
      reason: "Tách thủ công",
    });
    for (const x of ts.slice(idx)) await db.tasks.update(x.id, { moduleId: newId });
    await normalizeMilestones(md.courseId);
  });
}