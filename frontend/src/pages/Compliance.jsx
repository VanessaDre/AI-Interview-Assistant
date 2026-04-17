import { useState, useEffect } from 'react'
import { Shield, CheckCircle, Copy, Check } from 'lucide-react'
import { getAiDisclosure, getCandidateRights } from '../services/api'

export default function Compliance() {
  const [disclosure, setDisclosure] = useState(null)
  const [rights, setRights] = useState(null)
  const [copied, setCopied] = useState(false)
  const [lang, setLang] = useState('de')

  useEffect(() => {
    getAiDisclosure().then(r => setDisclosure(r.data)).catch(() => {})
    getCandidateRights().then(r => setRights(r.data)).catch(() => {})
  }, [])

  const copyDisclosure = () => {
    if (!disclosure) return
    const text = disclosure.disclosure[lang]
    navigator.clipboard.writeText(`${text.title}\n\n${text.text}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Compliance</h2>
      <p className="text-sm text-gray-400 mb-6">EU AI Act und DSGVO Transparenz</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Shield size={18} className="text-brand-500" /><h3 className="font-medium text-gray-700">KI-Hinweis für Bewerber</h3></div>
            <div className="flex gap-1">
              {['de', 'en'].map(l => (
                <button key={l} onClick={() => setLang(l)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${lang === l ? 'bg-brand-100 text-brand-700' : 'text-gray-400 hover:bg-surface-100'}`}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          {disclosure && (
            <div className="bg-surface-50 rounded-xl p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">{disclosure.disclosure[lang]?.title}</h4>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{disclosure.disclosure[lang]?.text}</p>
            </div>
          )}
          <button onClick={copyDisclosure} className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-700 transition-colors">
            {copied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Text kopieren</>}
          </button>
          {disclosure?.system_info && (
            <div className="mt-4 pt-4 border-t border-surface-200 space-y-1 text-xs text-gray-500">
              <p>System: {disclosure.system_info.system_name} v{disclosure.system_info.version}</p>
              <p>AI: {disclosure.system_info.ai_provider}</p>
              <p>Architektur: {disclosure.system_info.architecture}</p>
              <p>Risiko: {disclosure.system_info.risk_classification}</p>
            </div>
          )}
        </div>
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-6 shadow-sm">
          <h3 className="font-medium text-gray-700 mb-4">Bewerberrechte (DSGVO)</h3>
          {rights && (
            <div className="space-y-3">
              {rights.rights.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                  <CheckCircle size={16} className={`mt-0.5 shrink-0 ${r.implemented ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">{r.article}</span>
                      <span className="text-sm text-gray-700">{r.right}</span>
                    </div>
                    <p className="text-xs text-gray-500">{r.how}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
