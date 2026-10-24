// tells a student their passport changed: one email per issued version, georgian first, then
// english. sent from its own queue job, so a mail problem never touches an issue.
import { and, desc, eq, inArray, lt, passports, passportVersions, skillAwards, students, type Db } from "@passport/db";

export type Mail = { to: { email: string; name: string }; subject: string; html: string; text: string };
export type Notice = {
  email: string; firstName: string; lastName: string; passportId: string;
  versionNo: number; code: string; newSkills: string[];
};

// the test data's students are fictional; those addresses must never be mailed
export const shouldEmail = (email: string) => !/@example\.(org|com|net)$/i.test(email.trim());

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderMail(n: Notice, publicBaseUrl: string): Mail {
  const base = publicBaseUrl.replace(/\/$/, "");
  const me = `${base}/me`, verify = `${base}/v/${n.code}`;
  const first = n.versionNo === 1;
  const ka = {
    hello: `გამარჯობა, ${n.firstName}!`,
    what: first ? "BTU-მ თქვენთვის AI უნარების ციფრული პასპორტი გასცა." : `თქვენს AI უნარების ციფრულ პასპორტს ახალი უნარი დაემატა. მიმდინარე ვერსიაა V${n.versionNo}.`,
    skills: first ? "უნარები:" : "ახალი:",
    button: "პასპორტის ჩამოტვირთვა",
    verify: "შემოწმების ბმული, რომელიც შეგიძლიათ გაუზიაროთ სხვებს:",
    why: `ეს წერილი მიიღეთ, რადგან BTU-მ ${n.email}-ისთვის დადასტურებული AI უნარი დაარეგისტრირა. პასპორტი ${n.passportId}.`,
  };
  const en = {
    hello: `Hello ${n.firstName},`,
    what: first ? "BTU has issued your AI Skills Digital Passport." : `A new skill was added to your AI Skills Digital Passport. It is now at version ${n.versionNo}.`,
    skills: first ? "Skills:" : "New:",
    button: "Download your passport",
    verify: "Verify link you can share:",
    why: `You get this email because BTU recorded a confirmed AI skill for ${n.email}. Passport ${n.passportId}.`,
  };
  const subject = first
    ? `თქვენი AI უნარების პასპორტი გაიცა | Your AI Skills Passport was issued`
    : `თქვენი AI უნარების პასპორტი განახლდა (V${n.versionNo}) | Your AI Skills Passport was updated (V${n.versionNo})`;

  const skillList = n.newSkills.length ? n.newSkills : [];
  const block = (t: typeof ka, lang: string) => `
    <div lang="${lang}" style="margin:0 0 28px">
      <p style="margin:0 0 12px;font-size:17px;color:#111"><b>${esc(t.hello)}</b></p>
      <p style="margin:0 0 12px;font-size:15px;color:#333">${esc(t.what)}</p>
      ${skillList.length ? `<p style="margin:0 0 16px;font-size:15px;color:#333">${esc(t.skills)} <b style="color:#111">${skillList.map(esc).join(", ")}</b></p>` : ""}
      <p style="margin:0 0 16px"><a href="${me}" style="display:inline-block;background:#fe017e;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px">${esc(t.button)}</a></p>
      <p style="margin:0;font-size:14px;color:#555">${esc(t.verify)} <a href="${verify}" style="color:#0000b5">${verify}</a></p>
    </div>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f2f2f2;font-family:Arial,'Noto Sans Georgian',sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff">
      <div style="background:#0000b5;padding:20px 24px;color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">AI SKILLS DIGITAL PASSPORT <span style="color:#fe017e">BTU</span></div>
      <div style="padding:28px 24px 8px">${block(ka, "ka")}<hr style="border:0;border-top:1px solid #e1e1e1;margin:0 0 28px">${block(en, "en")}</div>
      <div style="padding:16px 24px;background:#222;color:#bbb;font-size:12px;line-height:1.5"><p lang="ka" style="margin:0 0 6px">${esc(ka.why)}</p><p style="margin:0">${esc(en.why)}</p></div>
    </div></body></html>`;
  const text = [ka.hello, ka.what, skillList.length ? `${ka.skills} ${skillList.join(", ")}` : "", `${ka.button}: ${me}`, `${ka.verify} ${verify}`, "",
    en.hello, en.what, skillList.length ? `${en.skills} ${skillList.join(", ")}` : "", `${en.button}: ${me}`, `${en.verify} ${verify}`, "",
    ka.why, en.why].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

  return { to: { email: n.email, name: `${n.firstName} ${n.lastName}` }, subject, html, text };
}

// everything the email needs about one issued version; the new skills are those this version
// has and the one before it didn't
export async function loadNotice(db: Db, code: string): Promise<Notice | null> {
  const [row] = await db.select({ v: passportVersions, s: students }).from(passportVersions)
    .innerJoin(passports, eq(passports.passportId, passportVersions.passportId))
    .innerJoin(students, eq(students.studentId, passports.studentId))
    .where(and(eq(passportVersions.verificationCode, code), eq(passportVersions.state, "issued")));
  if (!row) return null;
  const [prev] = await db.select({ ids: passportVersions.includedRecordIds }).from(passportVersions)
    .where(and(eq(passportVersions.passportId, row.v.passportId), lt(passportVersions.versionNo, row.v.versionNo), eq(passportVersions.state, "issued")))
    .orderBy(desc(passportVersions.versionNo)).limit(1);
  const before = new Set(prev?.ids ?? []);
  const added = row.v.includedRecordIds.filter((id) => !before.has(id));
  const skills = added.length ? await db.select({ name: skillAwards.skillName }).from(skillAwards).where(inArray(skillAwards.recordId, added)) : [];
  return {
    email: row.s.email, firstName: row.s.firstName, lastName: row.s.lastName, passportId: row.v.passportId,
    versionNo: row.v.versionNo, code, newSkills: skills.map((s) => s.name),
  };
}

// brevo's transactional email api; throws on anything but success so the job retries
export function brevoSender(apiKey: string, from: { email: string; name: string }) {
  return async (mail: Mail): Promise<string> => {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: from, to: [mail.to], subject: mail.subject, htmlContent: mail.html, textContent: mail.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`brevo ${res.status}: ${body.slice(0, 200)}`);
    return (JSON.parse(body) as { messageId?: string }).messageId ?? "";
  };
}
