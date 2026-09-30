import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { generateStory, generatePanelImage, type Story } from "@/lib/comic.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ComicCraft — Create AI Comics in Minutes" },
      { name: "description", content: "Describe an idea, pick a tone and art style, and ComicCraft writes and illustrates your comic. Download it as a PDF." },
      { property: "og:title", content: "ComicCraft — Create AI Comics in Minutes" },
      { property: "og:description", content: "AI-written, AI-illustrated comics you can download as PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TONES: [string, ...string[]] = ["Adventurous", "Funny", "Dark", "Heartwarming", "Mysterious"];
const STYLES: [string, ...string[]] = ["Classic American", "Manga", "Watercolor", "Noir", "Cartoon"];

function Chips({ options, value, onChange }: { options: string[]; value: string | undefined; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded border-2 border-border px-3 py-1 text-sm font-bold transition ${value === o ? "bg-secondary comic-shadow" : "bg-card hover:bg-muted"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Index() {
  const storyFn = useServerFn(generateStory);
  const imageFn = useServerFn(generatePanelImage);
  const [idea, setIdea] = useState("");
  const [hero, setHero] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [style, setStyle] = useState(STYLES[0]);
  const [count, setCount] = useState(4);
  const [story, setStory] = useState<Story | null>(null);
  const [images, setImages] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState(false);

  async function create(revise = false) {
    if (idea.trim().length < 3) { toast.error("Describe your story idea first."); return; }
    setBusy(true);
    try {
      const s = await storyFn({
        data: { idea, hero, tone, style, panels: count, previous: revise && story ? JSON.stringify(story) : undefined },
      });
      setStory(s);
      setImages(s.panels.map(() => null));
      await Promise.all(
        s.panels.map(async (p, i) => {
          try {
            const { url } = await imageFn({ data: { scene: p.scene, style } });
            setImages((prev) => prev.map((v, j) => (j === i ? url : v)));
          } catch (e) {
            setImages((prev) => prev.map((v, j) => (j === i ? "error" : v)));
            toast.error((e as Error).message);
          }
        }),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!story) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    doc.setFont("helvetica", "bold").setFontSize(24).text(story.title, W / 2, 20, { align: "center" });
    let y = 30;
    story.panels.forEach((p, i) => {
      if (y > 200) { doc.addPage(); y = 15; }
      const img = images[i];
      if (img && img !== "error") doc.addImage(img, 20, y, 80, 80);
      doc.setDrawColor(0).setLineWidth(0.8).rect(20, y, 80, 80);
      doc.setFont("helvetica", "bold").setFontSize(11).text(`Panel ${i + 1}`, 108, y + 6);
      doc.setFont("helvetica", "italic").setFontSize(10).text(doc.splitTextToSize(p.caption, 82), 108, y + 14);
      doc.setFont("helvetica", "normal").setFontSize(11).text(doc.splitTextToSize(`"${p.dialogue}"`, 82), 108, y + 45);
      y += 88;
    });
    doc.save(`${story.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  }

  const imagesPending = images.some((v) => v === null);

  return (
    <div className="min-h-screen bg-background halftone text-foreground">
      <Toaster />
      <header className="border-b-4 border-border bg-primary py-6 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-comic-title text-5xl md:text-6xl">ComicCraft</h1>
          <p className="text-lg font-bold">Your idea. AI story. AI art. Instant comic.</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[380px_1fr]">
        <section className="h-fit space-y-5 rounded border-4 border-border bg-card p-5 comic-shadow">
          <div className="space-y-2">
            <Label className="font-bold">Story idea</Label>
            <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} placeholder="A shy robot who discovers it can paint the sky..." className="border-2" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Main character (optional)</Label>
            <Input value={hero} onChange={(e) => setHero(e.target.value)} placeholder="e.g. Maya, a 10-year-old inventor" className="border-2" />
          </div>
          <div className="space-y-2"><Label className="font-bold">Tone</Label><Chips options={TONES} value={tone} onChange={setTone} /></div>
          <div className="space-y-2"><Label className="font-bold">Art style</Label><Chips options={STYLES} value={style} onChange={setStyle} /></div>
          <div className="space-y-2">
            <Label className="font-bold">Panels: {count}</Label>
            <input type="range" min={2} max={8} value={count} onChange={(e) => setCount(+e.target.value)} className="w-full accent-[var(--primary)]" />
          </div>
          <Button onClick={() => create(false)} disabled={busy} className="w-full border-2 border-border text-lg font-bold comic-shadow">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Create comic
          </Button>
          {story && (
            <Button variant="secondary" onClick={() => create(true)} disabled={busy} className="w-full border-2 border-border font-bold">
              <RefreshCw /> Remake with new tone / style
            </Button>
          )}
        </section>

        <section>
          {!story && !busy && (
            <div className="flex h-full min-h-80 items-center justify-center rounded border-4 border-dashed border-border bg-card/70 p-8 text-center">
              <p className="font-comic-title text-3xl">Your comic will appear here — POW!</p>
            </div>
          )}
          {busy && !story && (
            <div className="flex min-h-80 items-center justify-center gap-3 font-bold"><Loader2 className="animate-spin" /> Writing your story…</div>
          )}
          {story && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-comic-title text-4xl">{story.title}</h2>
                <Button onClick={downloadPdf} disabled={imagesPending} variant="outline" className="border-2 border-border font-bold">
                  <Download /> Download PDF
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {story.panels.map((p, i) => (
                  <article key={i} className="overflow-hidden rounded border-4 border-border bg-card comic-shadow">
                    <div className="border-b-4 border-border bg-secondary px-3 py-2 text-sm font-bold">{p.caption}</div>
                    <div className="relative aspect-square bg-muted">
                      {images[i] === null && <div className="absolute inset-0 flex items-center justify-center gap-2 font-bold"><Loader2 className="animate-spin" /> Drawing…</div>}
                      {images[i] === "error" && <div className="absolute inset-0 flex items-center justify-center font-bold">Couldn't draw this panel</div>}
                      {images[i] && images[i] !== "error" && <img src={images[i]!} alt={p.scene} className="h-full w-full object-cover" />}
                    </div>
                    <p className="p-3 text-lg font-bold">“{p.dialogue}”</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
