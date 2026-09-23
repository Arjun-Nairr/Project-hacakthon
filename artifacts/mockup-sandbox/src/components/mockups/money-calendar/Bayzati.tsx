import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Compass,
  Home,
  Plus,
  ShieldCheck,
  Sparkles,
  Sprout,
  WalletCards,
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
  { day: "01", month: "SEP", title: "Payday", detail: "Salary · Emirates NBD", amount: "+ 29,400", kind: "income", tone: "#1681a3" },
  { day: "12", month: "SEP", title: "Car instalment", detail: "Toyota Camry · monthly", amount: "− 2,180", kind: "commitment", tone: "#d14b83" },
  { day: "18", month: "SEP", title: "School fees", detail: "Term 1 · GEMS Wellington", amount: "− 4,200", kind: "commitment", tone: "#d14b83" },
  { day: "27", month: "SEP", title: "Rent cheque", detail: "Jumeirah Village Circle", amount: "− 7,600", kind: "commitment", tone: "#d14b83" },
];

function BayzatiLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-[12px] bg-[#092e59] text-[#f6f8fb] shadow-[0_5px_14px_rgba(9,46,89,.18)]">
        <span className="font-['Fraunces'] text-[20px] font-semibold italic">B</span>
      </div>
      <div className="leading-none">
        <p className="font-['Fraunces'] text-[20px] font-semibold tracking-[-.04em] text-[#092e59]">Bayzati</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-[.13em] text-[#7e8da1]">by</span>
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
        <p className="font-mono text-[9px] font-semibold tracking-[.12em] text-[#8c9aae]">{event.month}</p>
        <p className="mt-0.5 text-[19px] font-semibold leading-none text-[#173a62]">{event.day}</p>
      </div>
      <div className="relative flex h-[34px] w-[10px] shrink-0 items-center justify-center">
        <span className="absolute h-full w-px bg-[#dce5ef] group-last:h-0" />
        <span className="relative size-2.5 rounded-full border-2 border-[#f7f9fc]" style={{ backgroundColor: event.tone, boxShadow: `0 0 0 2px ${event.tone}22` }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#173a62]">{event.title}</p>
        <p className="mt-0.5 truncate text-[10px] text-[#8391a3]">{event.detail}</p>
      </div>
      <span className={`whitespace-nowrap rounded-full px-2 py-1 font-mono text-[10px] font-semibold ${event.kind === "income" ? "bg-[#e4f2f6] text-[#167491]" : "bg-[#f8e6ed] text-[#b13b6b]"}`}>
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

  return (
    <main className="relative h-[844px] w-full overflow-hidden bg-[#f6f8fb] font-['DM_Sans'] text-[#173a62]" style={{ maxWidth: 390 }}>
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[#e5eef7] opacity-70" />
      <div className="relative px-5 pb-[132px] pt-7">
        <header className="flex items-center justify-between">
          <BayzatiLogo />
          <div className="flex items-center gap-2">
            <button aria-label="Notifications" className="grid size-9 place-items-center rounded-full border border-[#dce5ef] bg-white text-[#58718c]"><Bell size={16} strokeWidth={1.8} /></button>
            <div className="grid size-9 place-items-center rounded-full bg-[#e6edf5] text-[11px] font-semibold text-[#092e59]">MA</div>
          </div>
        </header>

        <section className="mt-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8795a7]">Money calendar</p>
              <h1 className="mt-1 font-['Fraunces'] text-[28px] leading-none tracking-[-.04em] text-[#092e59]">September 2025</h1>
            </div>
            <button className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-[#55708e] shadow-sm"><CalendarDays size={14} /> This month</button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[25px] bg-[#092e59] px-5 py-5 text-white shadow-[0_12px_24px_rgba(9,46,89,.16)]">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#afc3d9]"><ShieldCheck size={14} className="text-[#d94c84]" /> Safe to spend</p>
            <button aria-label="What is safe to spend?" className="text-[#afc3d9]"><CircleHelp size={15} /></button>
          </div>
          <p className="mt-3 font-mono text-[36px] font-semibold tracking-[-.07em]">AED 11,050</p>
          <p className="mt-1.5 text-[12px] leading-5 text-[#c5d4e3]">You’re in a comfortable place for the rest of September.</p>
          <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
            <div><p className="text-[10px] text-[#9db3ca]">Next large payment</p><p className="mt-1 text-[13px] font-semibold">Rent cheque · 27 Sep</p></div>
            <p className="font-mono text-[12px] font-semibold text-[#f08bb0]">AED 7,600</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[72%] rounded-full bg-[#d94c84]" /></div>
          <p className="mt-2 text-[10px] text-[#a8bfd6]">AED 5,472 set aside · 72%</p>
        </section>

        <div className="mt-4 flex items-center gap-2 rounded-[15px] border border-[#f0cbd9] bg-[#fff7fa] px-3.5 py-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f8e0e9] text-[#c34375]"><Sparkles size={14} /></span>
          <p className="text-[11px] leading-4 text-[#6e4a5c]"><span className="font-semibold text-[#a93462]">A gentle heads-up:</span> cash feels tight on the 27th. Your rent is covered if you keep the set-aside untouched.</p>
        </div>

        <section className="mt-5 rounded-[21px] border border-[#e2e9f1] bg-white px-4 py-3 shadow-[0_7px_18px_rgba(38,64,91,.04)]">
          <div className="flex items-center justify-between pb-1">
            <h2 className="font-['Fraunces'] text-[19px] font-semibold text-[#092e59]">Coming up</h2>
            <button className="flex items-center gap-1 text-[10px] font-semibold text-[#55708e]">See all <ChevronRight size={13} /></button>
          </div>
          {events.map((event) => <EventRow key={event.title} event={event} />)}
        </section>
      </div>

      <button onClick={() => setSheetOpen(true)} className="absolute bottom-[104px] right-5 z-20 flex items-center gap-2 rounded-full bg-[#d94c84] px-4 py-3 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(217,76,132,.28)] transition-transform active:scale-95"><Plus size={17} /> Add to calendar</button>

      <div className="absolute inset-x-4 bottom-4 z-20 flex items-center gap-2">
        <nav className="flex h-[74px] flex-1 items-center justify-around rounded-[38px] border border-[#d8e0e9] bg-white/95 px-1.5 shadow-[0_10px_26px_rgba(30,60,91,.13)] backdrop-blur-md">
          <button aria-label="Home" className="flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[30px] text-[#536b84] transition-transform active:scale-95">
            <Home size={21} strokeWidth={1.8} /><span className="text-[10px] font-semibold">Home</span>
          </button>
          <button aria-label="Cash" className="flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[30px] text-[#536b84] transition-transform active:scale-95">
            <WalletCards size={21} strokeWidth={1.8} /><span className="text-[10px] font-semibold">Cash</span>
          </button>
          <button aria-label="Plan" className="flex h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full bg-[#edf0f2] text-[#092e59] transition-transform active:scale-95">
            <span className="grid size-[29px] place-items-center rounded-full bg-[#092e59] text-[#dcecf1] shadow-[0_3px_8px_rgba(9,46,89,.18)]"><Compass size={16} strokeWidth={2.2} /></span>
            <span className="text-[10px] font-bold">Plan</span>
          </button>
          <button aria-label="Invest" className="flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[30px] text-[#536b84] transition-transform active:scale-95">
            <Sprout size={21} strokeWidth={1.8} /><span className="text-[10px] font-semibold">Invest</span>
          </button>
        </nav>
        <button aria-label="Open Bayzati assistant" onClick={() => setAssistantOpen(true)} className="relative grid size-[66px] shrink-0 place-items-center rounded-full border border-[#d8e0e9] bg-white/95 shadow-[0_10px_26px_rgba(30,60,91,.15)] transition-transform active:scale-95">
          <span className="absolute inset-[7px] rounded-full bg-[#dceff6] opacity-90 blur-[5px]" />
          <span className="relative grid size-[43px] place-items-center rounded-full bg-[#092e59] text-[#bce3ed] shadow-[inset_0_0_0_2px_rgba(133,210,225,.2)]">
            <Sparkles size={19} strokeWidth={1.7} />
            <i className="absolute right-[7px] top-[8px] size-1.5 rounded-full bg-[#d94c84]" />
          </span>
        </button>
      </div>

      {sheetOpen && <div className="absolute inset-0 z-30 bg-[#092e59]/45" onClick={() => setSheetOpen(false)}>
        <section onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 rounded-t-[27px] bg-[#f9fbfd] px-5 pb-7 pt-5 shadow-[0_-16px_35px_rgba(9,46,89,.18)]">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#c8d3df]" />
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8795a7]">Update your month</p><h2 className="mt-1 font-['Fraunces'] text-[25px] font-semibold text-[#092e59]">Add something new</h2></div><button aria-label="Close" onClick={() => setSheetOpen(false)} className="grid size-8 place-items-center rounded-full border border-[#dce5ef] text-[#667b93]"><X size={16} /></button></div>
          <div className="mt-5 flex rounded-full bg-[#e9eef4] p-1 text-[12px] font-semibold"><button onClick={() => setEntryType("income")} className={`flex-1 rounded-full py-2 ${entryType === "income" ? "bg-white text-[#092e59] shadow-sm" : "text-[#8391a3]"}`}><ArrowDownLeft className="mr-1 inline size-3.5 text-[#1681a3]" />Income</button><button onClick={() => setEntryType("commitment")} className={`flex-1 rounded-full py-2 ${entryType === "commitment" ? "bg-white text-[#092e59] shadow-sm" : "text-[#8391a3]"}`}><ArrowUpRight className="mr-1 inline size-3.5 text-[#d94c84]" />Commitment</button></div>
          <label className="mt-5 block text-[11px] font-semibold text-[#536b84]">What should we call it?<input placeholder={entryType === "income" ? "e.g. Salary" : "e.g. School fees"} className="mt-1.5 w-full rounded-xl border border-[#d4dfe9] bg-white px-3.5 py-3 text-[13px] outline-none placeholder:text-[#a4afbc] focus:border-[#6689a8]" /></label>
          <div className="mt-3 flex gap-3"><label className="flex-1 text-[11px] font-semibold text-[#536b84]">Amount<input placeholder="AED 0" className="mt-1.5 w-full rounded-xl border border-[#d4dfe9] bg-white px-3.5 py-3 text-[13px] outline-none placeholder:text-[#a4afbc]" /></label><label className="w-[108px] text-[11px] font-semibold text-[#536b84]">Day<input placeholder="27" className="mt-1.5 w-full rounded-xl border border-[#d4dfe9] bg-white px-3.5 py-3 text-[13px] outline-none placeholder:text-[#a4afbc]" /></label></div>
          <button onClick={() => { setSaved(true); setTimeout(() => setSheetOpen(false), 700); }} className="mt-5 w-full rounded-xl bg-[#092e59] py-3.5 text-[13px] font-semibold text-white">{saved ? "Added to your calendar" : "Save to my calendar"}</button>
          <p className="mt-3 text-center text-[10px] text-[#8a99aa]">Your information stays private to you.</p>
        </section>
      </div>}

      {assistantOpen && <div className="absolute inset-0 z-40 bg-[#092e59]/25" onClick={() => setAssistantOpen(false)}>
        <section onClick={(e) => e.stopPropagation()} className="absolute inset-x-4 bottom-[98px] rounded-[24px] border border-[#dce5ef] bg-[#fbfdff] px-4 py-4 shadow-[0_16px_35px_rgba(9,46,89,.2)]">
          <div className="flex items-start justify-between">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8795a7]">Bayzati assistant</p><h2 className="mt-1 font-['Fraunces'] text-[21px] font-semibold text-[#092e59]">A calmer money moment.</h2></div>
            <button aria-label="Close assistant" onClick={() => setAssistantOpen(false)} className="grid size-8 place-items-center rounded-full border border-[#dce5ef] text-[#667b93]"><X size={15} /></button>
          </div>
          <button onClick={() => setAssistantOpen(false)} className="mt-4 w-full rounded-[15px] bg-[#eef5f8] px-3.5 py-3 text-left text-[12px] font-semibold leading-5 text-[#173a62] transition-transform active:scale-[.98]">“What can I safely spend this week?”<span className="mt-1 block text-[10px] font-normal text-[#6d849a]">Try a question about your plan or upcoming commitments.</span></button>
        </section>
      </div>}
    </main>
  );
}

export default Bayzati;