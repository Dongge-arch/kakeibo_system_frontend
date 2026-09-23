import { Baby as BabyIcon, CalendarDays, Check, CirclePlus, Clipboard, Droplets, HeartPulse, Milk, Moon, Save, Thermometer, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Baby, BabyDay, BabyEvent, BabyEventType, Family } from "../api/homeTypes";

type Props = { userId: string; notify: (message: string, tone?: "success" | "error" | "info") => void };

const eventLabels: Record<BabyEventType, string> = {
  feed: "授乳", diaper: "おむつ", temperature: "体温", sleep: "睡眠", growth: "成長", note: "メモ"
};

const eventIcons = { feed: Milk, diaper: Droplets, temperature: Thermometer, sleep: Moon, growth: HeartPulse, note: Clipboard };

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nowLocal() {
  const date = new Date();
  return `${today()}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eventText(event: BabyEvent) {
  const data = event.data;
  if (event.type === "feed") return `${data.method === "breast" ? "母乳" : data.method === "formula" ? "ミルク" : "搾乳"}${data.amountMl ? ` · ${data.amountMl} ml` : ""}${data.durationMin ? ` · ${data.durationMin} 分` : ""}`;
  if (event.type === "diaper") return data.kind === "both" ? "おしっこ・うんち" : data.kind === "wet" ? "おしっこ" : "うんち";
  if (event.type === "temperature") return `${data.temperatureC} °C`;
  if (event.type === "sleep") return `${data.durationMin} 分`;
  if (event.type === "growth") return `${data.weightKg ? `${data.weightKg} kg` : ""} ${data.lengthCm ? `${data.lengthCm} cm` : ""}`.trim();
  return String(data.text || "");
}

const emptyEvent = (babyId: string, type: BabyEventType = "feed"): BabyEvent => ({ babyId, type, happenedAt: nowLocal(),
  data: type === "feed" ? { method: "breast", amountMl: "", durationMin: "", side: "" } :
    type === "diaper" ? { kind: "wet" } : type === "temperature" ? { temperatureC: "" } :
      type === "sleep" ? { durationMin: "" } : type === "growth" ? { weightKg: "", lengthCm: "" } : { text: "" } });

export function ChildcarePage({ userId, notify }: Props) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyId, setBabyId] = useState("");
  const [day, setDay] = useState(today());
  const [dayData, setDayData] = useState<BabyDay | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [invite, setInvite] = useState("");
  const [babyDraft, setBabyDraft] = useState<Baby | null>(null);
  const [eventDraft, setEventDraft] = useState<BabyEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const family = families.find(row => row.familyId === familyId);
  const baby = babies.find(row => row.babyId === babyId);

  async function loadFamilies() {
    try {
      const rows = await api.childcare.families();
      setFamilies(rows);
      setFamilyId(current => rows.some(row => row.familyId === current) ? current : rows[0]?.familyId || "");
    } catch (error) { notify((error as Error).message, "error"); }
  }

  useEffect(() => { loadFamilies().catch(console.error); }, [userId]);
  useEffect(() => {
    setInvite("");
    if (!familyId) { setBabies([]); setBabyId(""); return; }
    api.childcare.babies(familyId).then(rows => {
      setBabies(rows);
      setBabyId(current => rows.some(row => row.babyId === current) ? current : rows[0]?.babyId || "");
    }).catch(error => notify((error as Error).message, "error"));
  }, [familyId]);
  useEffect(() => {
    if (!babyId) { setDayData(null); setEventDraft(null); return; }
    api.childcare.day(babyId, day).then(setDayData).catch(error => notify((error as Error).message, "error"));
    setEventDraft(emptyEvent(babyId));
  }, [babyId, day]);

  async function createFamily() {
    if (!familyName.trim()) return;
    setBusy(true);
    try {
      const result = await api.childcare.createFamily(familyName);
      await loadFamilies();
      setFamilyId(result.familyId);
      setFamilyName("");
      notify("家族を作成しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
  }

  async function joinFamily() {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const result = await api.childcare.joinFamily(joinCode.trim());
      await loadFamilies();
      setFamilyId(result.familyId);
      setJoinCode("");
      notify("家族に参加しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
  }

  async function saveBaby() {
    if (!babyDraft) return;
    setBusy(true);
    try {
      const result = await api.childcare.saveBaby(babyDraft);
      const rows = await api.childcare.babies(familyId);
      setBabies(rows);
      setBabyId(result.babyId);
      setBabyDraft(null);
      notify("赤ちゃんの情報を保存しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
  }

  async function deleteBaby() {
    if (!babyId || !confirm("赤ちゃんとすべての記録を削除しますか？")) return;
    try {
      await api.childcare.deleteBaby(babyId);
      const rows = await api.childcare.babies(familyId);
      setBabies(rows);
      setBabyId(rows[0]?.babyId || "");
      notify("削除しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
  }

  async function saveEvent() {
    if (!eventDraft || !babyId) return;
    setBusy(true);
    try {
      await api.childcare.saveEvent(eventDraft);
      setDayData(await api.childcare.day(babyId, day));
      setEventDraft(emptyEvent(babyId, eventDraft.type));
      notify("記録しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
  }

  async function deleteEvent(eventId: string) {
    if (!babyId || !confirm("この記録を削除しますか？")) return;
    try {
      await api.childcare.deleteEvent(babyId, eventId);
      setDayData(await api.childcare.day(babyId, day));
      notify("削除しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
  }

  function dataField(key: string, value: string | number) {
    if (!eventDraft) return;
    setEventDraft({ ...eventDraft, data: { ...eventDraft.data, [key]: value } });
  }

  return <div className="module-workspace childcare-workspace">
    <section className="module-section family-section">
      <div className="module-heading"><Users size={20} /><h1>家族</h1></div>
      <div className="module-action-row">
        {families.length > 0 && <select aria-label="家族" value={familyId} onChange={event => setFamilyId(event.target.value)}>{families.map(row => <option key={row.familyId} value={row.familyId}>{row.name}</option>)}</select>}
        <input aria-label="新しい家族名" placeholder="家族名" value={familyName} onChange={event => setFamilyName(event.target.value)} />
        <button type="button" className="command-button command-button--primary" disabled={busy || !familyName.trim()} onClick={createFamily}><CirclePlus size={17} /> 作成</button>
      </div>
      <div className="module-action-row">
        <input aria-label="招待コード" placeholder="招待コード" value={joinCode} onChange={event => setJoinCode(event.target.value)} />
        <button type="button" className="command-button command-button--ghost" disabled={busy || !joinCode.trim()} onClick={joinFamily}>参加</button>
      </div>
      {family && <div className="family-details">
        <div className="family-member-list">{family.members.map(member => <span key={member.userId}>{member.name}{member.role === "owner" && <small>管理者</small>}
          {family.ownerUserId === userId && member.userId !== userId && <button type="button" title="メンバーを解除" onClick={async () => {
            if (!confirm(`${member.name}さんの共有を解除しますか？`)) return;
            try { await api.childcare.removeMember(familyId, member.userId); await loadFamilies(); }
            catch (error) { notify((error as Error).message, "error"); }
          }}><Trash2 size={14} /></button>}
        </span>)}</div>
        {family.ownerUserId === userId && <button type="button" className="command-button command-button--ghost" onClick={async () => {
          try { const result = await api.childcare.invite(familyId); setInvite(result.code); }
          catch (error) { notify((error as Error).message, "error"); }
        }}>招待コードを発行</button>}
        {invite && <div className="invite-code"><code>{invite}</code><button type="button" title="コピー" onClick={async () => { await navigator.clipboard.writeText(invite); notify("コピーしました。", "success"); }}><Clipboard size={17} /></button><small>24時間・1回のみ有効</small></div>}
      </div>}
    </section>

    {family && <section className="module-section baby-section">
      <div className="module-heading"><BabyIcon size={21} /><h2>赤ちゃん</h2><button type="button" className="command-button command-button--primary" onClick={() => setBabyDraft({ familyId, name: "", birthDate: today(), notes: "" })}><CirclePlus size={17} /> 追加</button></div>
      <div className="module-action-row">{babies.map(row => <button key={row.babyId} type="button" className={`baby-tab ${row.babyId === babyId ? "is-active" : ""}`} onClick={() => setBabyId(row.babyId || "")}>{row.name}</button>)}
        {baby && <button type="button" className="icon-command" title="基本情報を編集" onClick={() => setBabyDraft({ ...baby })}><BabyIcon size={18} /></button>}</div>
      {babyDraft && <div className="baby-editor module-form-grid">
        <label className="field"><span>名前</span><input value={babyDraft.name} onChange={event => setBabyDraft({ ...babyDraft, name: event.target.value })} /></label>
        <label className="field"><span>生年月日</span><input type="date" value={babyDraft.birthDate} onChange={event => setBabyDraft({ ...babyDraft, birthDate: event.target.value })} /></label>
        <label className="field module-span"><span>メモ</span><textarea value={babyDraft.notes} onChange={event => setBabyDraft({ ...babyDraft, notes: event.target.value })} /></label>
        <div className="module-action-row module-span"><button type="button" className="command-button command-button--ghost" onClick={() => setBabyDraft(null)}>キャンセル</button><button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveBaby}><Save size={17} /> 保存</button>
          {babyDraft.babyId && <button type="button" className="command-button command-button--ghost danger-text" onClick={deleteBaby}><Trash2 size={17} /> 削除</button>}</div>
      </div>}
      {!babies.length && !babyDraft && <p className="module-empty">赤ちゃんの情報を登録してください。</p>}
    </section>}

    {baby && <>
      <div className="baby-day-header"><div><span className="section-kicker">Daily Log</span><h2>{baby.name}の記録</h2></div><label><CalendarDays size={18} /><input type="date" value={day} onChange={event => setDay(event.target.value)} /></label></div>
      <div className="baby-summary">
        <div><Milk size={19} /><span>授乳</span><strong>{dayData?.summary.feeds || 0} 回</strong><small>{dayData?.summary.milkMl || 0} ml</small></div>
        <div><Droplets size={19} /><span>おむつ</span><strong>{dayData?.summary.wet || 0} 尿</strong><small>{dayData?.summary.stool || 0} 便</small></div>
        <div><Moon size={19} /><span>睡眠</span><strong>{Math.floor((dayData?.summary.sleepMinutes || 0) / 60)} 時間</strong><small>{(dayData?.summary.sleepMinutes || 0) % 60} 分</small></div>
        <div><Thermometer size={19} /><span>体温</span><strong>{dayData?.summary.temperatures[0] ?? "—"} °C</strong><small>最新</small></div>
      </div>
      <div className="baby-log-layout">
        <section className="module-section">
          <div className="module-heading"><h2>{eventDraft?.eventId ? "記録を編集" : "記録を追加"}</h2></div>
          {eventDraft && <div className="module-form">
            <div className="event-type-grid">{(Object.keys(eventLabels) as BabyEventType[]).map(type => {
              const Icon = eventIcons[type];
              return <button type="button" key={type} className={eventDraft.type === type ? "is-active" : ""} onClick={() => setEventDraft(emptyEvent(babyId, type))}><Icon size={18} />{eventLabels[type]}</button>;
            })}</div>
            <label className="field"><span>日時</span><input type="datetime-local" value={eventDraft.happenedAt} onChange={event => setEventDraft({ ...eventDraft, happenedAt: event.target.value })} /></label>
            {eventDraft.type === "feed" && <div className="module-form-grid">
              <label className="field"><span>方法</span><select value={eventDraft.data.method || "breast"} onChange={event => dataField("method", event.target.value)}><option value="breast">母乳</option><option value="formula">ミルク</option><option value="expressed">搾乳</option></select></label>
              <label className="field"><span>左右</span><select value={eventDraft.data.side || ""} onChange={event => dataField("side", event.target.value)}><option value="">—</option><option value="left">左</option><option value="right">右</option><option value="both">両方</option></select></label>
              <label className="field"><span>量 (ml)</span><input type="number" min="0" value={eventDraft.data.amountMl ?? ""} onChange={event => dataField("amountMl", event.target.value)} /></label>
              <label className="field"><span>時間 (分)</span><input type="number" min="0" value={eventDraft.data.durationMin ?? ""} onChange={event => dataField("durationMin", event.target.value)} /></label>
            </div>}
            {eventDraft.type === "diaper" && <label className="field"><span>内容</span><select value={eventDraft.data.kind || "wet"} onChange={event => dataField("kind", event.target.value)}><option value="wet">おしっこ</option><option value="stool">うんち</option><option value="both">両方</option></select></label>}
            {eventDraft.type === "temperature" && <label className="field"><span>体温 (°C)</span><input type="number" step="0.1" value={eventDraft.data.temperatureC ?? ""} onChange={event => dataField("temperatureC", event.target.value)} /></label>}
            {eventDraft.type === "sleep" && <label className="field"><span>睡眠時間 (分)</span><input type="number" min="1" value={eventDraft.data.durationMin ?? ""} onChange={event => dataField("durationMin", event.target.value)} /></label>}
            {eventDraft.type === "growth" && <div className="module-form-grid"><label className="field"><span>体重 (kg)</span><input type="number" step="0.01" value={eventDraft.data.weightKg ?? ""} onChange={event => dataField("weightKg", event.target.value)} /></label><label className="field"><span>身長 (cm)</span><input type="number" step="0.1" value={eventDraft.data.lengthCm ?? ""} onChange={event => dataField("lengthCm", event.target.value)} /></label></div>}
            {eventDraft.type === "note" && <label className="field"><span>メモ</span><textarea value={eventDraft.data.text ?? ""} onChange={event => dataField("text", event.target.value)} /></label>}
            <div className="module-action-row"><button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveEvent}><Save size={17} /> 保存</button>{eventDraft.eventId && <button type="button" className="command-button command-button--ghost" onClick={() => setEventDraft(emptyEvent(babyId))}>キャンセル</button>}</div>
          </div>}
        </section>
        <section className="module-section"><div className="module-heading"><h2>タイムライン</h2><span>{dayData?.events.length || 0} 件</span></div>
          <div className="baby-timeline">{dayData?.events.map(event => {
            const Icon = eventIcons[event.type];
            return <article key={event.eventId} className="baby-event"><span className="baby-event-icon"><Icon size={19} /></span><div><time>{event.happenedAt.slice(11, 16)}</time><strong>{eventLabels[event.type]}</strong><p>{eventText(event)}</p></div><button type="button" className="icon-command" title="編集" onClick={() => setEventDraft({ ...event, happenedAt: event.happenedAt.slice(0, 16) })}><Check size={17} /></button><button type="button" className="icon-command" title="削除" onClick={() => event.eventId && deleteEvent(event.eventId)}><Trash2 size={17} /></button></article>;
          })}{!dayData?.events.length && <p className="module-empty">この日の記録はありません。</p>}</div>
        </section>
      </div>
    </>}
  </div>;
}
