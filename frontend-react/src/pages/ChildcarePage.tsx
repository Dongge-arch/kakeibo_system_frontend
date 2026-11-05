import { Baby as BabyIcon, Bath, CalendarDays, Check, ChevronLeft, ChevronRight, CirclePlus, Clipboard, Droplets, HeartPulse, Milk, Moon, Save, Thermometer, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Baby, BabyDay, BabyEvent, BabyEventType, BabyMonth, Family } from "../api/homeTypes";

type Props = { userId: string; notify: (message: string, tone?: "success" | "error" | "info") => void };

const eventLabels: Record<BabyEventType, string> = {
  feed: "授乳", diaper: "おむつ", temperature: "体温", sleep: "睡眠", bath: "お風呂", growth: "成長", note: "メモ"
};

const eventIcons = { feed: Milk, diaper: Droplets, temperature: Thermometer, sleep: Moon, bath: Bath, growth: HeartPulse, note: Clipboard };
const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nowLocal(targetDay = today()) {
  const date = new Date();
  return `${targetDay}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + amount, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(year, monthNumber - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date: localDateValue(date), day: date.getDate(), inMonth: date.getMonth() === monthNumber - 1 };
  });
}

function eventText(event: BabyEvent) {
  const data = event.data;
  if (event.type === "feed") return `${data.method === "breast" ? "母乳" : data.method === "formula" ? "ミルク" : "搾乳"}${data.amountMl ? ` · ${data.amountMl} ml` : ""}${data.durationMin ? ` · ${data.durationMin} 分` : ""}`;
  if (event.type === "diaper") return data.kind === "both" ? "おしっこ・うんち" : data.kind === "wet" ? "おしっこ" : "うんち";
  if (event.type === "temperature") return `${data.temperatureC} °C`;
  if (event.type === "sleep") return `${data.durationMin} 分`;
  if (event.type === "bath") return `${data.durationMin ? `${data.durationMin} 分` : "入浴"}${data.waterTempC ? ` · ${data.waterTempC} °C` : ""}${data.note ? ` · ${data.note}` : ""}`;
  if (event.type === "growth") return `${data.weightKg ? `${data.weightKg} kg` : ""} ${data.lengthCm ? `${data.lengthCm} cm` : ""}`.trim();
  return String(data.text || "");
}

const emptyEvent = (babyId: string, type: BabyEventType = "feed", targetDay = today()): BabyEvent => ({ babyId, type, happenedAt: nowLocal(targetDay),
  data: type === "feed" ? { method: "breast", amountMl: "", durationMin: "", side: "" } :
    type === "diaper" ? { kind: "wet" } : type === "temperature" ? { temperatureC: "" } :
      type === "sleep" ? { durationMin: "" } : type === "bath" ? { durationMin: "", waterTempC: "", note: "" } :
        type === "growth" ? { weightKg: "", lengthCm: "" } : { text: "" } });

export function ChildcarePage({ userId, notify }: Props) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyId, setBabyId] = useState("");
  const [day, setDay] = useState(today());
  const [dayData, setDayData] = useState<BabyDay | null>(null);
  // 2026-09-30 Codex: 日別記録と月間カレンダーを独立して読み込み、日付移動を軽くする。
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
  const [monthData, setMonthData] = useState<BabyMonth | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [invite, setInvite] = useState("");
  const [babyDraft, setBabyDraft] = useState<Baby | null>(null);
  const [babyValidationError, setBabyValidationError] = useState("");
  const [eventDraft, setEventDraft] = useState<BabyEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const family = families.find(row => row.familyId === familyId);
  const baby = babies.find(row => row.babyId === babyId);
  const monthDays = new Map((monthData?.days || []).map(item => [item.date, item]));

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
    setEventDraft(emptyEvent(babyId, "feed", day));
  }, [babyId, day]);
  useEffect(() => {
    if (!babyId) { setMonthData(null); return; }
    api.childcare.month(babyId, calendarMonth).then(setMonthData).catch(error => notify((error as Error).message, "error"));
  }, [babyId, calendarMonth]);

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
    // 2026-09-30 Codex: API送信前に項目別の理由を表示し、同じ400エラーの連続送信を防ぐ。
    if (!babyDraft.name.trim()) {
      setBabyValidationError("名前を入力してください。");
      return;
    }
    if (!babyDraft.birthDate) {
      setBabyValidationError("生年月日を入力してください。");
      return;
    }
    setBabyValidationError("");
    setBusy(true);
    try {
      const result = await api.childcare.saveBaby(babyDraft);
      const rows = await api.childcare.babies(familyId);
      setBabies(rows);
      setBabyId(result.babyId);
      setBabyDraft(null);
      setBabyValidationError("");
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
      const [nextDay, nextMonth] = await Promise.all([
        api.childcare.day(babyId, day),
        api.childcare.month(babyId, calendarMonth)
      ]);
      setDayData(nextDay);
      setMonthData(nextMonth);
      setEventDraft(emptyEvent(babyId, eventDraft.type, day));
      notify("記録しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
  }

  async function deleteEvent(eventId: string) {
    if (!babyId || !confirm("この記録を削除しますか？")) return;
    try {
      await api.childcare.deleteEvent(babyId, eventId);
      const [nextDay, nextMonth] = await Promise.all([
        api.childcare.day(babyId, day),
        api.childcare.month(babyId, calendarMonth)
      ]);
      setDayData(nextDay);
      setMonthData(nextMonth);
      notify("削除しました。", "success");
    } catch (error) { notify((error as Error).message, "error"); }
  }

  function dataField(key: string, value: string | number) {
    if (!eventDraft) return;
    setEventDraft({ ...eventDraft, data: { ...eventDraft.data, [key]: value } });
  }

  async function quickRecord(type: BabyEventType, data: Record<string, string | number>) {
    // 2026-09-30 Codex: よく使う記録は入力画面を開かず、現在時刻で即時保存する。
    if (!babyId || busy) return;
    const targetDay = today();
    const targetMonth = targetDay.slice(0, 7);
    setBusy(true);
    try {
      await api.childcare.saveEvent({ babyId, type, happenedAt: nowLocal(), data });
      const [nextDay, nextMonth] = await Promise.all([
        api.childcare.day(babyId, targetDay),
        api.childcare.month(babyId, targetMonth)
      ]);
      setDay(targetDay);
      setCalendarMonth(targetMonth);
      setDayData(nextDay);
      setMonthData(nextMonth);
      setEventDraft(emptyEvent(babyId, type, targetDay));
      notify(`${eventLabels[type]}を現在時刻で記録しました。`, "success");
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
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
      <div className="module-heading"><BabyIcon size={21} /><h2>赤ちゃん</h2><button type="button" className="command-button command-button--primary" onClick={() => { setBabyValidationError(""); setBabyDraft({ familyId, name: "", birthDate: "", notes: "" }); }}><CirclePlus size={17} /> 追加</button></div>
      <div className="module-action-row">{babies.map(row => <button key={row.babyId} type="button" className={`baby-tab ${row.babyId === babyId ? "is-active" : ""}`} onClick={() => setBabyId(row.babyId || "")}>{row.name}</button>)}
        {baby && <button type="button" className="icon-command" title="基本情報を編集" onClick={() => { setBabyValidationError(""); setBabyDraft({ ...baby }); }}><BabyIcon size={18} /></button>}</div>
      {babyDraft && <div className="baby-editor module-form-grid">
        <label className="field"><span>名前</span><input required value={babyDraft.name} onChange={event => { setBabyValidationError(""); setBabyDraft({ ...babyDraft, name: event.target.value }); }} /></label>
        <label className="field"><span>生年月日・出産予定日</span><input type="date" required value={babyDraft.birthDate} onChange={event => { setBabyValidationError(""); setBabyDraft({ ...babyDraft, birthDate: event.target.value }); }} /></label>
        <label className="field module-span"><span>メモ</span><textarea value={babyDraft.notes} onChange={event => setBabyDraft({ ...babyDraft, notes: event.target.value })} /></label>
        {babyValidationError && <small className="field-error module-span" role="alert">{babyValidationError}</small>}
        <div className="module-action-row module-span"><button type="button" className="command-button command-button--ghost" onClick={() => { setBabyDraft(null); setBabyValidationError(""); }}>キャンセル</button><button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveBaby}><Save size={17} /> 保存</button>
          {babyDraft.babyId && <button type="button" className="command-button command-button--ghost danger-text" onClick={deleteBaby}><Trash2 size={17} /> 削除</button>}</div>
      </div>}
      {!babies.length && !babyDraft && <p className="module-empty">赤ちゃんの情報を登録してください。</p>}
    </section>}

    {baby && <>
      <section className="baby-calendar" aria-label={`${calendarMonth}の育児カレンダー`}>
        <div className="baby-calendar-header">
          <button type="button" className="icon-command" title="前の月" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}><ChevronLeft size={20} /></button>
          <h2>{Number(calendarMonth.slice(0, 4))}年 {Number(calendarMonth.slice(5, 7))}月</h2>
          <button type="button" className="baby-calendar-today" onClick={() => { setCalendarMonth(today().slice(0, 7)); setDay(today()); }}>今日</button>
          <button type="button" className="icon-command" title="次の月" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}><ChevronRight size={20} /></button>
        </div>
        <div className="baby-calendar-weekdays">{weekDays.map(label => <span key={label}>{label}</span>)}</div>
        <div className="baby-calendar-grid">{calendarCells(calendarMonth).map(cell => {
          const recorded = monthDays.get(cell.date);
          return <button type="button" key={cell.date} className={`${cell.inMonth ? "" : "is-outside"} ${cell.date === day ? "is-selected" : ""} ${cell.date === today() ? "is-today" : ""}`} onClick={() => {
            setDay(cell.date);
            if (!cell.inMonth) setCalendarMonth(cell.date.slice(0, 7));
          }}>
            <span>{cell.day}</span>
            <span className="baby-calendar-dots">{recorded?.eventTypes.slice(0, 4).map(type => <i key={type} className={`is-${type}`} title={eventLabels[type]} />)}</span>
            {!!recorded?.count && <small>{recorded.count}</small>}
          </button>;
        })}</div>
      </section>

      <div className="baby-day-header"><div><span className="section-kicker">Daily Log</span><h2>{baby.name}の記録</h2></div><label><CalendarDays size={18} /><input type="date" value={day} onChange={event => { setDay(event.target.value); setCalendarMonth(event.target.value.slice(0, 7)); }} /></label></div>
      <div className="baby-quick-actions" aria-label="現在時刻でクイック記録">
        <button type="button" disabled={busy} onClick={() => quickRecord("feed", { method: "breast", amountMl: "", durationMin: "", side: "" })}><Milk size={18} /><span>母乳</span></button>
        <button type="button" disabled={busy} onClick={() => quickRecord("diaper", { kind: "wet" })}><Droplets size={18} /><span>おしっこ</span></button>
        <button type="button" disabled={busy} onClick={() => quickRecord("diaper", { kind: "stool" })}><Droplets size={18} /><span>うんち</span></button>
        <button type="button" disabled={busy} onClick={() => quickRecord("bath", {})}><Bath size={18} /><span>お風呂</span></button>
      </div>
      <div className="baby-summary">
        <div><Milk size={19} /><span>授乳</span><strong>{dayData?.summary.feeds || 0} 回</strong><small>{dayData?.summary.milkMl || 0} ml</small></div>
        <div><Droplets size={19} /><span>おむつ</span><strong>{dayData?.summary.wet || 0} 尿</strong><small>{dayData?.summary.stool || 0} 便</small></div>
        <div><Moon size={19} /><span>睡眠</span><strong>{Math.floor((dayData?.summary.sleepMinutes || 0) / 60)} 時間</strong><small>{(dayData?.summary.sleepMinutes || 0) % 60} 分</small></div>
        <div><Bath size={19} /><span>お風呂</span><strong>{dayData?.summary.baths || 0} 回</strong><small>入浴記録</small></div>
        <div><Thermometer size={19} /><span>体温</span><strong>{dayData?.summary.temperatures[0] ?? "—"} °C</strong><small>最新</small></div>
      </div>
      <div className="baby-log-layout">
        <section className="module-section">
          <div className="module-heading"><h2>{eventDraft?.eventId ? "記録を編集" : "記録を追加"}</h2></div>
          {eventDraft && <div className="module-form">
            <div className="event-type-grid">{(Object.keys(eventLabels) as BabyEventType[]).map(type => {
              const Icon = eventIcons[type];
              return <button type="button" key={type} className={eventDraft.type === type ? "is-active" : ""} onClick={() => setEventDraft(emptyEvent(babyId, type, day))}><Icon size={18} />{eventLabels[type]}</button>;
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
            {eventDraft.type === "bath" && <div className="module-form-grid"><label className="field"><span>入浴時間 (分)</span><input type="number" min="1" max="180" value={eventDraft.data.durationMin ?? ""} onChange={event => dataField("durationMin", event.target.value)} /></label><label className="field"><span>お湯の温度 (°C)</span><input type="number" min="20" max="50" step="0.1" value={eventDraft.data.waterTempC ?? ""} onChange={event => dataField("waterTempC", event.target.value)} /></label><label className="field module-span"><span>様子・メモ</span><input value={eventDraft.data.note ?? ""} onChange={event => dataField("note", event.target.value)} /></label></div>}
            {eventDraft.type === "growth" && <div className="module-form-grid"><label className="field"><span>体重 (kg)</span><input type="number" step="0.01" value={eventDraft.data.weightKg ?? ""} onChange={event => dataField("weightKg", event.target.value)} /></label><label className="field"><span>身長 (cm)</span><input type="number" step="0.1" value={eventDraft.data.lengthCm ?? ""} onChange={event => dataField("lengthCm", event.target.value)} /></label></div>}
            {eventDraft.type === "note" && <label className="field"><span>メモ</span><textarea value={eventDraft.data.text ?? ""} onChange={event => dataField("text", event.target.value)} /></label>}
            <div className="module-action-row"><button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveEvent}><Save size={17} /> 保存</button>{eventDraft.eventId && <button type="button" className="command-button command-button--ghost" onClick={() => setEventDraft(emptyEvent(babyId, "feed", day))}>キャンセル</button>}</div>
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
