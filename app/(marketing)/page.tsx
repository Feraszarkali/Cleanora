 "use client"

import { useState } from "react"
import LeadFormModal from "@/components/form/LeadFormModal"
import { motion } from "framer-motion"

export default function Home() {
  const [formOpen, setFormOpen] = useState(false)

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <LeadFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
      />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-32">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-sm text-gray-200">
                AI-powered cleaning marketplace
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-tight mb-8">
              Professionelle
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Reinigungsfirmen
              </span>
              intelligent finden
            </h1>

            <p className="text-xl text-gray-300 max-w-2xl leading-relaxed mb-10">
              Cleanora verbindet Unternehmen und Privatkunden mit passenden
              Reinigungsfirmen in Deutschland.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setFormOpen(true)}
                className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition text-white text-lg font-semibold shadow-2xl shadow-emerald-500/30"
              >
                Kostenloses Angebot erhalten
              </button>

              <button className="px-8 py-4 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 transition text-lg font-semibold backdrop-blur-md">
                Wie funktioniert es?
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Unsere Services
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Premium Reinigungsservices für Unternehmen und Privatkunden.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              "Büroreinigung",
              "Praxisreinigung",
              "Fensterreinigung",
              "Airbnb Reinigung",
              "Treppenhausreinigung",
              "Bauendreinigung",
              "Restaurantreinigung",
              "Unterhaltsreinigung",
            ].map((service, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -10 }}
                className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 mb-6"></div>
                <h3 className="text-2xl font-bold mb-4">{service}</h3>
                <p className="text-gray-600 leading-relaxed">
                  Professionelle und zuverlässige Reinigungslösungen.
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Wie funktioniert Cleanora?
            </h2>
            <p className="text-xl text-gray-600">
              Einfach, intelligent und schnell.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              "Anfrage senden",
              "KI analysiert Ihren Bedarf",
              "Passende Angebote erhalten",
            ].map((step, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.03 }}
                className="relative p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-blue-950 text-white overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl"></div>
                <div className="relative z-10">
                  <div className="text-6xl font-black text-emerald-400 mb-6">
                    {index + 1}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{step}</h3>
                  <p className="text-gray-300">
                    Modern AI-powered workflow für professionelle Reinigungslösungen.
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <div className="inline-flex px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8 backdrop-blur-md">
                KI Matching System
              </div>
              <h2 className="text-5xl font-black leading-tight mb-8">
                Unsere KI analysiert Ihre Anfrage intelligent
              </h2>
              <p className="text-xl text-gray-300 leading-relaxed mb-10">
                Cleanora nutzt moderne KI-Systeme, um passende Reinigungsfirmen
                schneller und effizienter zu finden.
              </p>
              <button className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition text-lg font-semibold">
                Mehr erfahren
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
              <div className="relative bg-white/10 border border-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl">
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-sm text-gray-400 mb-2">AI Lead Score</div>
                    <div className="text-3xl font-black text-emerald-400">GOLD</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-sm text-gray-400 mb-2">AI Summary</div>
                    <div className="text-lg text-white">
                      Büroreinigung für modernes Berliner Büro.
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-sm text-gray-400 mb-2">Matching Status</div>
                    <div className="text-lg text-emerald-400">
                      5 passende Firmen gefunden
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-black leading-tight mb-8">
            Bereit für professionelle Reinigung?
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Erhalten Sie kostenlose Angebote von passenden Reinigungsfirmen in Deutschland.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white text-xl font-bold shadow-2xl hover:scale-105 transition"
          >
            Kostenlos starten
          </button>
        </div>
      </section>

      <footer className="bg-slate-950 text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <h3 className="text-3xl font-black mb-4">Cleanora</h3>
              <p className="text-gray-400 leading-relaxed">
                KI-gestützte Vermittlung professioneller Reinigungsfirmen.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Services</h4>
              <ul className="space-y-3 text-gray-400">
                <li>Büroreinigung</li>
                <li>Praxisreinigung</li>
                <li>Fensterreinigung</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Unternehmen</h4>
              <ul className="space-y-3 text-gray-400">
                <li>Über uns</li>
                <li>Kontakt</li>
                <li>FAQ</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Rechtliches</h4>
              <ul className="space-y-3 text-gray-400">
                <li>Datenschutz</li>
                <li>Impressum</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-16 pt-8 text-gray-500 text-sm">
            © 2026 Cleanora. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}