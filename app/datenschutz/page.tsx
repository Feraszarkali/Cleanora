export default function DatenschutzPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Cleanora</p>
        <h1 className="mt-3 text-3xl font-semibold">Datenschutzerklärung</h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>
            Diese Seite dient als Platzhalter für die Datenschutzinformationen, die im Produktivbetrieb vollständig gepflegt werden müssen.
          </p>
          <p>
            Die Anfrageformulare verarbeiten Name, E-Mail, Telefonnummer, Ort und Projektangaben ausschließlich zur Vermittlung von Reinigungsleistungen.
          </p>
          <p>
            Für den Beta- und Produktionsstart sollte hier die finale rechtliche Fassung mit Verantwortlichem, Speicherdauer, Betroffenenrechten und Kontakt ergänzt werden.
          </p>
        </div>
      </div>
    </main>
  )
}