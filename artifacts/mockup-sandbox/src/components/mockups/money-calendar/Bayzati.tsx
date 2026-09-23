import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Home,
  Landmark,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";

type EventKind = "income" | "commitment";

const events: Array<{
  day: string;
  month: string;
  title: string;
  detail: string;
  amount: string;
  kind: EventKind;
  tone: string;
}> = [
  { day: "01", month: "SEP", title: "Payday", detail: "Salary · Emirates NBD", amount: "+ 29,400", kind: "income", tone: "#12A66A" },
  { day: "12", month: "SEP", title: "Car instalment", detail: "Toyota Camry · monthly", amount: "− 2,180", kind: "commitment", tone: "#D20A58" },
  { day: "18", month: "SEP", title: "School fees", detail: "Term 1 · GEMS Wellington", amount: "− 4,200", kind: "commitment", tone: "#D20A58" },
  { day: "27", month: "SEP", title: "Rent cheque", detail: "Jumeirah Village Circle", amount: "− 7,600", kind: "commitment", tone: "#D20A58" },
];

function BayzatiLogo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/__mockup/images/bayzati-logo.png" alt="Bayzati" className="size-9 object-contain" />
      <div className="leading-none">
        <p className="text-[19px] font-semibold tracking-[-.04em] text-[#003B73]">bayzati</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-[.13em] text-[#98A2B3]">by</span>
          <img src="/__mockup/images/cbi-logo.png" alt="CBI UAE" className="h-[11px] w-auto object-contain" />
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: (typeof events)[number] }) {
  return (
    <div className="group flex items-center gap-3.5 py-3.5">
      <div className="w-[34px] shrink-0 text-center">
        <p className="text-[9px] font-semibold tracking-[.12em] text-[#98A2B3]">{event.month}</p>
        <p className="mt-0.5 text-[19px] font-semibold leading-none text-[#003B73]">{event.day}</p>
      </div>
      <div className="relative flex h-[34px] w-[10px] shrink-0 items-center justify-center">
        <span className="absolute h-full w-px bg-[#E4E7EC] group-last:h-0" />
        <span className="relative size-2.5 rounded-full border-2 border-[#FFFFFF]" style={{ backgroundColor: event.tone }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#17212B]">{event.title}</p>
        <p className="mt-0.5 truncate text-[10px] text-[#667085]">{event.detail}</p>
      </div>
      <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${event.kind === "income" ? "bg-[#F2F4F7] text-[#12A66A]" : "bg-[#FCEAF1] text-[#D20A58]"}`}>
        AED {event.amount}
      </span>
    </div>
  );
}

export function Bayzati() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [entryType, setEntryType] = useState<"income" | "commitment">("commitment");
  const [saved, setSaved] = useState(false);
  const [entryName, setEntryName] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDay, setEntryDay] = useState("");

  return (
    <main className="relative h-[844px] w-full overflow-hidden bg-[#F8FAFC] font-['Inter',system-ui,sans-serif] text-[#17212B]" style={{ maxWidth: 390 }}>
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[#EAF6FD] opacity-70" />
      <div className="relative px-5 pb-[140px] pt-6">
        <header className="flex items-center justify-between">
          <BayzatiLogo />
          <div className="flex items-center gap-2">
            <button aria-label="Notifications" onClick={() => setAssistantOpen(true)} className="grid size-11 place-items-center rounded-full border border-[#E4E7EC] bg-[#FFFFFF] text-[#667085] transition-colors hover:text-[#003B73]"><Bell size={17} strokeWidth={1.8} /></button>
            <button aria-label="Open profile" onClick={() => setAssistantOpen(true)} className="grid size-11 place-items-center rounded-full bg-[#EAF6FD] text-[11px] font-semibold text-[#003B73]">MA</button>
          </div>
        </header>

        <section className="mt-7">
          <div className="flex items-center justify-between">
            <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#667085]">Money calendar</p>
            <h1 className="mt-1 text-[28px] font-bold leading-none tracking-[-.04em] text-[#003B73]">September 2025</h1>
            </div>
            <button onClick={() => setAssistantOpen(true)} className="flex min-h-11 items-center gap-1 rounded-full border border-[#E4E7EC] bg-[#FFFFFF] px-3 py-2 text-[10px] font-semibold text-[#003B73]"><CalendarDays size={14} /> This month</button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[18px] bg-[#003B73] px-5 py-5 text-[#FFFFFF]">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#EAF6FD]"><ShieldCheck size={14} className="text-[#139BE8]" /> Safe to spend</p>
            <button aria-label="What is safe to spend?" onClick={() => setAssistantOpen(true)} className="text-[#EAF6FD]"><CircleHelp size={15} /></button>
          </div>
          <p className="mt-3 text-[36px] font-bold tabular-nums tracking-[-.07em]">AED 11,050</p>
          <p className="mt-1.5 text-[12px] leading-5 text-[#EAF6FD]">You’re in a comfortable place for the rest of September.</p>
          <div className="mt-5 flex items-end justify-between border-t border-[#FFFFFF]/15 pt-4">
            <div><p className="text-[10px] text-[#98A2B3]">Next large payment</p><p className="mt-1 text-[13px] font-semibold">Rent cheque · 27 Sep</p></div>
            <p className="text-[12px] font-semibold text-[#D20A58]">AED 7,600</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#FFFFFF]/15"><div className="h-full w-[72%] rounded-full bg-[#139BE8]" /></div>
          <p className="mt-2 text-[10px] text-[#EAF6FD]">AED 5,472 set aside · 72%</p>
        </section>

        <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-[#D20A58]/25 bg-[#FCEAF1] px-3.5 py-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#FFFFFF] text-[#D20A58]"><Sparkles size={14} /></span>
          <p className="text-[11px] leading-4 text-[#667085]"><span className="font-semibold text-[#D20A58]">A gentle heads-up:</span> cash feels tight on the 27th. Your rent is covered if you keep the set-aside untouched.</p>
        </div>

        <section className="mt-5 h-[216px] overflow-y-auto rounded-[18px] border border-[#E4E7EC] bg-[#FFFFFF] px-4 py-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-[19px] font-bold text-[#003B73]">Coming up</h2>
            <button onClick={() => setSheetOpen(true)} className="flex min-h-11 items-center gap-1 text-[10px] font-semibold text-[#139BE8]">See all <ChevronRight size={13} /></button>
          </div>
          {events.map((event) => <EventRow key={event.title} event={event} />)}
        </section>
      </div>

      <button onClick={() => { setSaved(false); setSheetOpen(true); }} className="absolute bottom-[106px] right-5 z-20 flex min-h-11 items-center gap-2 rounded-full bg-[#D20A58] px-4 py-3 text-[12px] font-semibold text-[#FFFFFF] transition-transform active:scale-95"><Plus size={17} /> Add to calendar</button>

      <div className="absolute inset-x-4 bottom-4 z-20 flex items-center gap-2">
        <nav className="flex h-[70px] flex-1 items-center justify-around rounded-full border border-[#E4E7EC] bg-[#FFFFFF] px-1 shadow-[0_2px_8px_rgba(0,46,93,.05)]">
          <button aria-label="Home" onClick={() => setAssistantOpen(false)} className="flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[#667085] transition-transform active:scale-95">
            <Home size={20} strokeWidth={1.8} /><span className="text-[10px] font-semibold">Home</span>
          </button>
          <button aria-label="Plan" onClick={() => setSheetOpen(false)} className="flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full bg-[#EAF6FD] text-[#003B73] transition-transform active:scale-95">
            <Landmark size={20} strokeWidth={1.8} /><span className="text-[10px] font-bold">Plan</span>
          </button>
          <button aria-label="Goals" onClick={() => setAssistantOpen(true)} className="flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[#667085] transition-transform active:scale-95">
            <Target size={20} strokeWidth={1.8} /><span className="text-[10px] font-semibold">Goals</span>
          </button>
          <button aria-label="Learn" onClick={() => setAssistantOpen(true)} className="flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[#667085] transition-transform active:scale-95">
            <CreditCard size={20} strokeWidth={1.8} /><span className="text-[10px] font-semibold">Learn</span>
          </button>
        </nav>
        <button aria-label="Open Bayzati assistant" onClick={() => setAssistantOpen(true)} className="relative grid size-[66px] shrink-0 place-items-center rounded-full border border-[#d8e0e9] bg-white/95 shadow-[0_10px_26px_rgba(30,60,91,.15)] transition-transform active:scale-95">
           <span className="relative grid size-[58px] place-items-center rounded-full border border-[#E4E7EC] bg-[#FFFFFF] text-[#003B73] shadow-[0_2px_8px_rgba(0,46,93,.05)]">
            <Sparkles size={19} strokeWidth={1.7} />
             <i className="absolute right-[13px] top-[11px] size-1.5 rounded-full bg-[#D20A58]" />
          </span>
        </button>
      </div>

      {sheetOpen && <div className="absolute inset-0 z-30 bg-[#092e59]/45" onClick={() => setSheetOpen(false)}>
         <section onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 rounded-t-[24px] border-t border-[#E4E7EC] bg-[#FFFFFF] px-5 pb-7 pt-5">
           <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#E4E7EC]" />
           <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#667085]">Update your month</p><h2 className="mt-1 text-[25px] font-bold text-[#003B73]">Add something new</h2></div><button aria-label="Close" onClick={() => setSheetOpen(false)} className="grid size-11 place-items-center rounded-full border border-[#E4E7EC] text-[#667085]"><X size={16} /></button></div>
           <div className="mt-5 flex rounded-full bg-[#F2F4F7] p-1 text-[12px] font-semibold"><button onClick={() => setEntryType("income")} className={`min-h-11 flex-1 rounded-full ${entryType === "income" ? "bg-[#FFFFFF] text-[#003B73]" : "text-[#667085]"}`}><ArrowDownLeft className="mr-1 inline size-3.5 text-[#12A66A]" />Income</button><button onClick={() => setEntryType("commitment")} className={`min-h-11 flex-1 rounded-full ${entryType === "commitment" ? "bg-[#FFFFFF] text-[#003B73]" : "text-[#667085]"}`}><ArrowUpRight className="mr-1 inline size-3.5 text-[#D20A58]" />Commitment</button></div>
           <label className="mt-5 block text-[11px] font-semibold text-[#667085]">What should we call it?<input value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder={entryType === "income" ? "e.g. Salary" : "e.g. School fees"} className="mt-1.5 w-full rounded-xl border border-[#E4E7EC] bg-[#FFFFFF] px-3.5 py-3 text-[13px] outline-none placeholder:text-[#98A2B3] focus:border-[#139BE8]" /></label>
           <div className="mt-3 flex gap-3"><label className="flex-1 text-[11px] font-semibold text-[#667085]">Amount<input value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder="AED 0" className="mt-1.5 w-full rounded-xl border border-[#E4E7EC] bg-[#FFFFFF] px-3.5 py-3 text-[13px] outline-none placeholder:text-[#98A2B3]" /></label><label className="w-[108px] text-[11px] font-semibold text-[#667085]">Day<input value={entryDay} onChange={(e) => setEntryDay(e.target.value)} placeholder="27" className="mt-1.5 w-full rounded-xl border border-[#E4E7EC] bg-[#FFFFFF] px-3.5 py-3 text-[13px] outline-none placeholder:text-[#98A2B3]" /></label></div>
           <button onClick={() => { setSaved(true); setTimeout(() => setSheetOpen(false), 700); }} className="mt-5 min-h-11 w-full rounded-xl bg-[#003B73] py-3.5 text-[13px] font-semibold text-[#FFFFFF]">{saved ? "Added to your calendar" : "Save to my calendar"}</button>
           <p className="mt-3 text-center text-[10px] text-[#98A2B3]">Your information stays private to you.</p>
        </section>
      </div>}

      {assistantOpen && <div className="absolute inset-0 z-40 bg-[#092e59]/25" onClick={() => setAssistantOpen(false)}>
         <section onClick={(e) => e.stopPropagation()} className="absolute inset-x-4 bottom-[98px] rounded-[18px] border border-[#E4E7EC] bg-[#FFFFFF] px-4 py-4 shadow-[0_2px_8px_rgba(0,46,93,.05)]">
          <div className="flex items-start justify-between">
             <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#D20A58]">Bayzati assistant</p><h2 className="mt-1 text-[21px] font-bold text-[#003B73]">A calmer money moment.</h2></div>
             <button aria-label="Close assistant" onClick={() => setAssistantOpen(false)} className="grid size-11 place-items-center rounded-full border border-[#E4E7EC] text-[#667085]"><X size={15} /></button>
          </div>
           <button onClick={() => setAssistantOpen(false)} className="mt-4 w-full rounded-[15px] bg-[#EAF6FD] px-3.5 py-3 text-left text-[12px] font-semibold leading-5 text-[#003B73] transition-transform active:scale-[.98]">“What can I safely spend this week?”<span className="mt-1 block text-[10px] font-normal text-[#667085]">Try a question about your plan or upcoming commitments.</span></button>
        </section>
      </div>}
    </main>
  );
}

export default Bayzati;