import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CloudUpload,
  CreditCard,
  FileCheck2,
  FileText,
  Info,
  Landmark,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import {
  getListImportsQueryKey,
  useCreateDocumentImport,
  useDeleteImportedRecord,
  useListImports,
  useRequestUploadUrl,
  useReviewImportedRecord,
  useStartAccountConnection,
  type AccountConnectionInput,
  type DocumentImportInput,
  type ImportedRecord,
} from "@workspace/api-client-react";

type Modal = "account" | "document" | null;
type UploadStage = "idle" | "requesting" | "uploading" | "indexing";

const documentTypes: Array<{
  value: DocumentImportInput["documentType"];
  label: string;
  hint: string;
}> = [
  { value: "bank-statement", label: "Bank statement", hint: "Balances and regular payments" },
  { value: "payslip", label: "Payslip", hint: "Salary and allowances" },
  { value: "credit-card-statement", label: "Credit-card statement", hint: "Card dues and spending" },
  { value: "tenancy-contract", label: "Tenancy contract", hint: "Rent and renewal dates" },
  { value: "school-fee-schedule", label: "School-fee schedule", hint: "Upcoming fee commitments" },
];

const accountTypes: Array<{
  value: AccountConnectionInput["accountType"];
  label: string;
}> = [
  { value: "current", label: "Current account" },
  { value: "savings", label: "Savings account" },
  { value: "credit-card", label: "Credit card" },
];

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-border bg-background/80 px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/15";
const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0";
const buttonQuiet =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary/45 disabled:cursor-not-allowed disabled:opacity-55";

function formatDate(value?: string | null) {
  if (!value) return "Not yet synced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatAED(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function sourceLabel(type: ImportedRecord["source"]["type"]) {
  return documentTypes.find((item) => item.value === type)?.label ?? "Imported document";
}

function statusCopy(status: ImportedRecord["reviewStatus"]) {
  if (status === "duplicate") return "Possible duplicate";
  if (status === "accepted") return "Added to plan";
  if (status === "rejected") return "Not added";
  return "Needs your review";
}

function StatusBadge({ status }: { status: ImportedRecord["reviewStatus"] }) {
  const styles = {
    "needs-review": "border-amber-200 bg-amber-50 text-amber-800",
    duplicate: "border-rose-200 bg-rose-50 text-rose-800",
    accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-slate-200 bg-slate-100 text-slate-600",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${styles[status]}`}>
      <CircleDot className="h-3 w-3" />
      {statusCopy(status)}
    </span>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />;
}

export default function ImportHub() {
  const queryClient = useQueryClient();
  const importsQuery = useListImports();
  const startConnection = useStartAccountConnection();
  const createDocument = useCreateDocumentImport();
  const reviewRecord = useReviewImportedRecord();
  const deleteRecord = useDeleteImportedRecord();
  const requestUpload = useRequestUploadUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [connectionForm, setConnectionForm] = useState<AccountConnectionInput>({
    institution: "",
    accountName: "",
    accountType: "current",
  });
  const [documentForm, setDocumentForm] = useState<{
    documentType: DocumentImportInput["documentType"];
    label: string;
    amount: string;
    day: string;
    kind: DocumentImportInput["kind"];
    paymentType: DocumentImportInput["paymentType"];
    amountType: DocumentImportInput["amountType"];
    accountName: string;
    note: string;
  }>({
    documentType: "bank-statement",
    label: "",
    amount: "",
    day: "1",
    kind: "fixed",
    paymentType: "rent",
    amountType: "fixed",
    accountName: "",
    note: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");

  const queue = importsQuery.data;
  const records = queue?.records ?? [];
  const connections = queue?.connections ?? [];
  const reviewCount = useMemo(
    () => records.filter((record) => record.reviewStatus === "needs-review" || record.reviewStatus === "duplicate").length,
    [records],
  );

  const closeModal = () => {
    if (startConnection.isPending || uploadStage !== "idle") return;
    setModal(null);
    setSelectedFile(null);
  };

  const showNotice = (tone: "success" | "error", message: string) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const refreshImports = () => {
    void queryClient.invalidateQueries({ queryKey: getListImportsQueryKey() });
  };

  const handleConnection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!connectionForm.institution.trim() || !connectionForm.accountName.trim()) return;
    try {
      await startConnection.mutateAsync({
        data: {
          institution: connectionForm.institution.trim(),
          accountName: connectionForm.accountName.trim(),
          accountType: connectionForm.accountType,
        },
      });
      setConnectionForm({ institution: "", accountName: "", accountType: "current" });
      setModal(null);
      showNotice("success", "Connection request sent. Your bank stays read-only.");
      refreshImports();
    } catch (error) {
      showNotice("error", getErrorMessage(error, "We could not start that connection. Please try again."));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setDocumentForm((current) => ({
      ...current,
      label: current.label || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
    }));
  };

  const handleDocumentImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !documentForm.label.trim() || !documentForm.accountName.trim()) return;
    const contentType = selectedFile.type || "application/octet-stream";
    try {
      setUploadStage("requesting");
      const upload = await requestUpload.mutateAsync({
        data: { name: selectedFile.name, size: selectedFile.size, contentType },
      });
      setUploadStage("uploading");
      const uploadResponse = await fetch(upload.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: selectedFile,
      });
      if (!uploadResponse.ok) throw new Error("The document could not be uploaded.");
      setUploadStage("indexing");
      await createDocument.mutateAsync({
        data: {
          documentType: documentForm.documentType,
          fileName: selectedFile.name,
          contentType,
          size: selectedFile.size,
          objectPath: upload.objectPath,
          label: documentForm.label.trim(),
          amount: Math.max(0, Number(documentForm.amount) || 0),
          day: Math.min(31, Math.max(1, Number(documentForm.day) || 1)),
          kind: documentForm.kind,
          paymentType: documentForm.paymentType,
          amountType: documentForm.amountType,
          accountName: documentForm.accountName.trim(),
          ...(documentForm.note.trim() ? { note: documentForm.note.trim() } : {}),
        },
      });
      setUploadStage("idle");
      setModal(null);
      setSelectedFile(null);
      setDocumentForm((current) => ({ ...current, label: "", amount: "", accountName: "", note: "" }));
      showNotice("success", "Document added to your review queue.");
      refreshImports();
    } catch (error) {
      setUploadStage("idle");
      showNotice("error", getErrorMessage(error, "We could not bring in that document. Nothing was added."));
    }
  };

  const handleReview = async (record: ImportedRecord, decision: "accept" | "reject") => {
    try {
      await reviewRecord.mutateAsync({ id: record.id, data: { decision } });
      showNotice("success", decision === "accept" ? "Record added to your money calendar." : "Record set aside.");
      refreshImports();
    } catch (error) {
      showNotice("error", getErrorMessage(error, "That review could not be saved."));
    }
  };

  const handleDelete = async (record: ImportedRecord) => {
    if (!window.confirm(`Delete “${record.event.label}” and its financial effect?`)) return;
    try {
      await deleteRecord.mutateAsync({ id: record.id });
      showNotice("success", "Record deleted. Its financial effect is gone.");
      refreshImports();
    } catch (error) {
      showNotice("error", getErrorMessage(error, "That record could not be deleted."));
    }
  };

  return (
    <main className="page-grain min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="reveal flex flex-col justify-between gap-6 border-b border-border/70 pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Your money, in one place
            </div>
            <h1 className="font-display text-5xl leading-[0.94] text-foreground sm:text-6xl">
              Bring the paper trail <span className="text-primary">into focus.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Connect an account or add a document. Bayzati turns the details into a plan you can review before anything changes.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-secondary-border bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-secondary-foreground md:self-auto">
            <ShieldCheck className="h-4 w-4" />
            Private by design
          </div>
        </header>

        <section className="reveal reveal-delay-1 mt-8 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-primary p-6 text-primary-foreground shadow-lg sm:p-8">
            <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[26px] border-sidebar-primary/20" />
            <div className="absolute -bottom-24 right-20 h-48 w-48 rounded-full border-[18px] border-sidebar-primary/10" />
            <div className="relative max-w-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-sidebar-primary">
                <LockKeyhole className="h-4 w-4" />
                Read-only, always
              </div>
              <h2 className="mt-7 max-w-lg font-display text-3xl leading-tight sm:text-4xl">
                Nothing moves until you say so.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/75">
                Connected accounts can only be read. Every imported record waits here for your review, and you can remove it and its effect from your plan at any time.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-primary-foreground/80">
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-sidebar-primary" />Freshness shown clearly</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-sidebar-primary" />90-day document retention</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-[1.75rem] border border-border bg-card p-6 shadow-sm sm:p-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono-data text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Review desk</span>
                <FileCheck2 className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-6 flex items-end gap-3">
                <span className="font-display text-6xl leading-none text-foreground">{reviewCount}</span>
                <span className="mb-1.5 text-sm leading-5 text-muted-foreground">item{reviewCount === 1 ? "" : "s"} waiting<br />for your eyes</span>
              </div>
            </div>
            <button type="button" className="mt-8 inline-flex items-center gap-2 self-start text-sm font-bold text-primary transition hover:gap-3" onClick={() => document.getElementById("review-queue")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-jump-review">
              See the review queue <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="reveal reveal-delay-2 mt-10" aria-labelledby="bring-in-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono-data text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Start gently</p>
              <h2 id="bring-in-heading" className="mt-1 font-display text-3xl text-foreground">Bring in what helps.</h2>
            </div>
            <span className="hidden text-right text-xs text-muted-foreground sm:block">You stay in control at every step.</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <button type="button" onClick={() => setModal("account")} className="soft-lift group rounded-[1.5rem] border border-border bg-card p-6 text-left shadow-sm" data-testid="button-connect-account">
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Landmark className="h-6 w-6" /></span>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h3 className="mt-7 text-lg font-bold text-foreground">Connect a UAE account</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">See balances and transactions without giving Bayzati permission to move money.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-primary"><LockKeyhole className="h-3.5 w-3.5" />Read-only permission</span>
            </button>
            <button type="button" onClick={() => setModal("document")} className="soft-lift group rounded-[1.5rem] border border-border bg-card p-6 text-left shadow-sm" data-testid="button-upload-document">
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><CloudUpload className="h-6 w-6" /></span>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" />
              </div>
              <h3 className="mt-7 text-lg font-bold text-foreground">Add a financial document</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Upload a statement, payslip, contract, or fee schedule, then normalize the details together.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-accent"><Trash2 className="h-3.5 w-3.5" />Automatically removed after 90 days</span>
            </button>
          </div>
        </section>

        <section className="reveal reveal-delay-3 mt-12" id="review-queue" aria-labelledby="queue-heading">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono-data text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Your call</p>
              <h2 id="queue-heading" className="mt-1 font-display text-3xl text-foreground">Review queue</h2>
            </div>
            <p className="text-sm text-muted-foreground">Nothing changes in your calendar until you accept it.</p>
          </div>

          {importsQuery.isLoading ? (
            <div className="grid gap-3">
              <SkeletonBlock className="h-28 w-full" />
              <SkeletonBlock className="h-28 w-full" />
            </div>
          ) : importsQuery.isError ? (
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="font-bold">The review queue is taking a moment.</h3>
                  <p className="mt-1 text-sm text-rose-800/80">Your existing plan is safe. Try loading the queue again.</p>
                  <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4" onClick={() => void importsQuery.refetch()} data-testid="button-retry-imports">
                    <RefreshCw className="h-4 w-4" /> Try again
                  </button>
                </div>
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-card/65 px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary"><FileText className="h-6 w-6" /></div>
              <h3 className="mt-5 font-display text-2xl text-foreground">A clear desk.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">When you bring in a document, it will appear here first. You decide what belongs in your money calendar.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {records.map((record) => (
                <article key={record.id} className="rounded-[1.35rem] border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 sm:p-6" data-testid={`card-import-record-${record.id}`}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary sm:flex">
                        {record.source.type === "credit-card-statement" ? <CreditCard className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold text-foreground">{record.event.label}</h3>
                          <StatusBadge status={record.reviewStatus} />
                        </div>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {sourceLabel(record.source.type)} · {record.event.accountName} · found {formatDate(record.discoveredAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-data text-xs text-foreground/75">
                          <span>{formatAED(record.event.amount)}</span>
                          <span>Day {record.event.day}</span>
                          <span className="text-muted-foreground">Fresh {formatDate(record.source.freshness)}</span>
                        </div>
                        {record.reviewStatus === "duplicate" && record.duplicateOf ? (
                          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700"><Info className="h-3.5 w-3.5" />Matches an existing record. Check before accepting.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                      {(record.reviewStatus === "needs-review" || record.reviewStatus === "duplicate") ? (
                        <>
                          <button type="button" className={buttonQuiet} onClick={() => void handleReview(record, "reject")} disabled={reviewRecord.isPending} data-testid={`button-reject-import-${record.id}`}>
                            <X className="h-4 w-4" /> Reject
                          </button>
                          <button type="button" className={buttonPrimary} onClick={() => void handleReview(record, "accept")} disabled={reviewRecord.isPending} data-testid={`button-accept-import-${record.id}`}>
                            {reviewRecord.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept
                          </button>
                        </>
                      ) : null}
                      <button type="button" aria-label={`Delete ${record.event.label}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" onClick={() => void handleDelete(record)} disabled={deleteRecord.isPending} data-testid={`button-delete-import-${record.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 border-t border-border/70 pt-9" aria-labelledby="connections-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono-data text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Quiet background</p>
              <h2 id="connections-heading" className="mt-1 font-display text-3xl text-foreground">Connected accounts</h2>
            </div>
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary" onClick={() => setModal("account")} data-testid="button-add-another-account">Add another <ChevronRight className="h-4 w-4" /></button>
          </div>
          {connections.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/60 px-5 py-6 text-sm text-muted-foreground">No accounts connected yet. A connection is optional; documents work just as well.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5" data-testid={`card-account-connection-${connection.id}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Building2 className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{connection.institution}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{connection.accountName} · {connection.accountType.replace("-", " ")}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${connection.status === "connected" ? "text-emerald-700" : connection.status === "pending" ? "text-amber-700" : "text-muted-foreground"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />{connection.status === "connected" ? "Connected" : connection.status === "pending" ? "Pending" : "Disconnected"}
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground">{connection.lastSyncedAt ? `Synced ${formatDate(connection.lastSyncedAt)}` : "Awaiting first sync"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 flex flex-col gap-3 border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-primary" />Account access is read-only. Bayzati cannot move your money.</p>
          <p className="inline-flex items-center gap-2"><Trash2 className="h-3.5 w-3.5 text-accent" />Uploaded documents are retained for 90 days, then removed.</p>
        </footer>
      </div>

      {notice ? (
        <div className={`fixed bottom-5 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-xl ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`} role="status" data-testid="status-import-notice">
          {notice.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{notice.message}</span>
          <button type="button" className="opacity-60 hover:opacity-100" onClick={() => setNotice(null)} aria-label="Dismiss notification" data-testid="button-dismiss-notice"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-primary/35 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-border bg-card shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem]">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 px-5 py-5 backdrop-blur sm:px-7">
              <div>
                <p className="font-mono-data text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{modal === "account" ? "Secure connection" : "Private document"}</p>
                <h2 className="mt-1 font-display text-3xl text-foreground">{modal === "account" ? "Connect an account" : "Add a document"}</h2>
              </div>
              <button type="button" onClick={closeModal} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close dialog" data-testid="button-close-import-dialog"><X className="h-5 w-5" /></button>
            </div>

            {modal === "account" ? (
              <form className="space-y-5 px-5 py-6 sm:px-7 sm:py-7" onSubmit={(event) => void handleConnection(event)}>
                <div className="rounded-2xl border border-secondary-border bg-secondary/40 p-4 text-sm leading-6 text-secondary-foreground">
                  <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Read-only access.</strong> We can look at balances and transactions, but never transfer, withdraw, or change anything.</p></div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-foreground sm:col-span-2">Bank or card provider<input className={fieldClass} value={connectionForm.institution} onChange={(event) => setConnectionForm((current) => ({ ...current, institution: event.target.value }))} placeholder="For example, Emirates NBD" required data-testid="input-institution" /></label>
                  <label className="text-sm font-semibold text-foreground">Account name<input className={fieldClass} value={connectionForm.accountName} onChange={(event) => setConnectionForm((current) => ({ ...current, accountName: event.target.value }))} placeholder="Everyday spending" required data-testid="input-account-name" /></label>
                  <label className="text-sm font-semibold text-foreground">Account type<select className={fieldClass} value={connectionForm.accountType} onChange={(event) => setConnectionForm((current) => ({ ...current, accountType: event.target.value as AccountConnectionInput["accountType"] }))} data-testid="select-account-type">{accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                  <button type="button" className={buttonQuiet} onClick={closeModal} data-testid="button-cancel-account">Not now</button>
                  <button type="submit" className={buttonPrimary} disabled={startConnection.isPending || !connectionForm.institution.trim() || !connectionForm.accountName.trim()} data-testid="button-submit-account">
                    {startConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Start read-only connection
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-5 px-5 py-6 sm:px-7 sm:py-7" onSubmit={(event) => void handleDocumentImport(event)}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-foreground sm:col-span-2">What are you adding?<select className={fieldClass} value={documentForm.documentType} onChange={(event) => setDocumentForm((current) => ({ ...current, documentType: event.target.value as DocumentImportInput["documentType"] }))} data-testid="select-document-type">{documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label} — {type.hint}</option>)}</select></label>
                  <div className="sm:col-span-2">
                    <span className="text-sm font-semibold text-foreground">Your file</span>
                    <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" onChange={handleFileChange} data-testid="input-document-file" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/35 bg-secondary/25 px-4 py-3.5 text-left transition hover:border-primary hover:bg-secondary/45" data-testid="button-choose-document">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm"><Upload className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-foreground">{selectedFile?.name ?? "Choose a PDF or image"}</strong><small className="mt-0.5 block text-xs text-muted-foreground">{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB · ready to upload` : "Sent directly to private storage"}</small></span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <label className="text-sm font-semibold text-foreground">Label<input className={fieldClass} value={documentForm.label} onChange={(event) => setDocumentForm((current) => ({ ...current, label: event.target.value }))} placeholder="Monthly salary" required data-testid="input-document-label" /></label>
                  <label className="text-sm font-semibold text-foreground">Account or source<input className={fieldClass} value={documentForm.accountName} onChange={(event) => setDocumentForm((current) => ({ ...current, accountName: event.target.value }))} placeholder="Salary account" required data-testid="input-document-account" /></label>
                  <label className="text-sm font-semibold text-foreground">Amount in AED<input type="number" min="0" step="0.01" className={fieldClass} value={documentForm.amount} onChange={(event) => setDocumentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="12450" required data-testid="input-document-amount" /></label>
                  <label className="text-sm font-semibold text-foreground">Day of month<input type="number" min="1" max="31" className={fieldClass} value={documentForm.day} onChange={(event) => setDocumentForm((current) => ({ ...current, day: event.target.value }))} required data-testid="input-document-day" /></label>
                  <label className="text-sm font-semibold text-foreground">Calendar bucket<select className={fieldClass} value={documentForm.kind} onChange={(event) => setDocumentForm((current) => ({ ...current, kind: event.target.value as DocumentImportInput["kind"] }))} data-testid="select-document-kind"><option value="income">Income</option><option value="fixed">Fixed commitment</option><option value="lump">One-off</option><option value="goal">Goal</option></select></label>
                  <label className="text-sm font-semibold text-foreground">Payment type<select className={fieldClass} value={documentForm.paymentType} onChange={(event) => setDocumentForm((current) => ({ ...current, paymentType: event.target.value as DocumentImportInput["paymentType"] }))} data-testid="select-document-payment-type"><option value="salary">Salary</option><option value="rent">Rent</option><option value="loan">Loan</option><option value="school">School</option><option value="credit-card">Credit card</option><option value="insurance">Insurance</option><option value="goal">Goal</option></select></label>
                  <label className="text-sm font-semibold text-foreground">Amount pattern<select className={fieldClass} value={documentForm.amountType} onChange={(event) => setDocumentForm((current) => ({ ...current, amountType: event.target.value as DocumentImportInput["amountType"] }))} data-testid="select-document-amount-type"><option value="fixed">Same each time</option><option value="variable">Changes each time</option><option value="range">A range</option></select></label>
                  <label className="text-sm font-semibold text-foreground sm:col-span-2">A note, if useful<textarea className={`${fieldClass} h-20 resize-none py-3`} value={documentForm.note} onChange={(event) => setDocumentForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional context for your future self" data-testid="textarea-document-note" /></label>
                </div>
                <div className="flex gap-3 rounded-2xl border border-border bg-muted/45 p-4 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>Uploaded documents are kept for 90 days, then automatically deleted. You can delete this record sooner from the review queue.</p></div>
                <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
                  <button type="button" className={buttonQuiet} onClick={closeModal} disabled={uploadStage !== "idle"} data-testid="button-cancel-document">Not now</button>
                  <button type="submit" className={buttonPrimary} disabled={uploadStage !== "idle" || !selectedFile || !documentForm.label.trim() || !documentForm.accountName.trim()} data-testid="button-submit-document">
                    {uploadStage !== "idle" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    {uploadStage === "requesting" ? "Preparing private upload…" : uploadStage === "uploading" ? "Uploading securely…" : uploadStage === "indexing" ? "Adding to review…" : "Add for review"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}