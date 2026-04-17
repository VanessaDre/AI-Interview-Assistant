import { useState, useEffect } from 'react'
import { Upload as UploadIcon, CheckCircle, ChevronRight, Shield } from 'lucide-react'
import { uploadJD, uploadCV, createRound, getJobDescriptions, getInterviewRounds } from '../services/api'

function StepBadge({ num, active, done }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
      done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-gray-400'
    }`}>{done ? <CheckCircle size={16} /> : num}</div>
  )
}

export default function UploadPage() {
  const [step, setStep] = useState(1)
  const [jds, setJds] = useState([])
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [jdFile, setJdFile] = useState(null)
  const [jdTitle, setJdTitle] = useState('')
  const [jdCompany, setJdCompany] = useState('')
  const [selectedJd, setSelectedJd] = useState(null)
  const [roundTitle, setRoundTitle] = useState('')
  const [selectedRound, setSelectedRound] = useState(null)
  const [cvFile, setCvFile] = useState(null)
  const [candidateName, setCandidateName] = useState('')

  useEffect(() => { getJobDescriptions().then(r => setJds(r.data)).catch(() => {}) }, [])
  useEffect(() => { if (selectedJd) getInterviewRounds(selectedJd).then(r => setRounds(r.data)).catch(() => {}) }, [selectedJd])

  const handleJdUpload = async () => {
    if (!jdFile || !jdTitle || !jdCompany) return
    setLoading(true)
    try { const res = await uploadJD(jdFile, jdTitle, jdCompany); setSelectedJd(res.data.id); setJds(p => [...p, res.data]); setStep(2) }
    catch (e) { alert('Upload failed: ' + (e.response?.data?.detail || e.message)) }
    setLoading(false)
  }
  const handleCreateRound = async () => {
    if (!roundTitle || !selectedJd) return
    setLoading(true)
    try { const res = await createRound(roundTitle, selectedJd); setSelectedRound(res.data.id); setRounds(p => [...p, res.data]); setStep(3) }
    catch (e) { alert('Failed: ' + (e.response?.data?.detail || e.message)) }
    setLoading(false)
  }
  const handleCvUpload = async () => {
    if (!cvFile || !candidateName || !selectedRound) return
    setLoading(true)
    try { const res = await uploadCV(cvFile, candidateName, selectedRound); setResult(res.data); setStep(4) }
    catch (e) { alert('Upload failed: ' + (e.response?.data?.detail || e.message)) }
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Upload</h2>
      <p className="text-sm text-gray-400 mb-6">Job Description und CV hochladen</p>
      <div className="flex items-center gap-3 mb-6">
        {[1,2,3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <StepBadge num={n} active={step === n} done={step > n} />
            <span className={`text-sm ${step === n ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
              {n === 1 ? 'Job Description' : n === 2 ? 'Interview Round' : 'CV Upload'}
            </span>
            {n < 3 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>
      <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-6 max-w-xl shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Schritt 1: Job Description</h3>
            {jds.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bestehende JD wählen:</label>
                <select className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" onChange={e => { setSelectedJd(e.target.value); if(e.target.value) setStep(2) }} value={selectedJd || ''}>
                  <option value="">Neue JD hochladen...</option>
                  {jds.map(j => <option key={j.id} value={j.id}>{j.title} – {j.company}</option>)}
                </select>
              </div>
            )}
            <div className="border-t border-surface-200 pt-4 space-y-3">
              <input type="text" placeholder="Jobtitel" value={jdTitle} onChange={e => setJdTitle(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <input type="text" placeholder="Unternehmen" value={jdCompany} onChange={e => setJdCompany(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <label className="flex items-center gap-3 border-2 border-dashed border-brand-200 rounded-xl p-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                <UploadIcon size={20} className="text-brand-400" />
                <span className="text-sm text-gray-500">{jdFile ? jdFile.name : 'PDF auswählen...'}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setJdFile(e.target.files[0])} />
              </label>
              <button onClick={handleJdUpload} disabled={loading || !jdFile} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                {loading ? 'Uploading...' : 'JD hochladen'}
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Schritt 2: Interview Round</h3>
            {rounds.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bestehende Round wählen:</label>
                <select className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" onChange={e => { setSelectedRound(e.target.value); if(e.target.value) setStep(3) }} value={selectedRound || ''}>
                  <option value="">Neue Round erstellen...</option>
                  {rounds.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
            <div className="border-t border-surface-200 pt-4 space-y-3">
              <input type="text" placeholder='z.B. "Python Dev – März 2026"' value={roundTitle} onChange={e => setRoundTitle(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <button onClick={handleCreateRound} disabled={loading || !roundTitle} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                {loading ? 'Erstelle...' : 'Round erstellen'}
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Schritt 3: CV hochladen</h3>
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-2">
              <Shield size={16} className="text-brand-600 mt-0.5 shrink-0" />
              <p className="text-xs text-brand-700">DSGVO: Der CV wird automatisch anonymisiert bevor die KI ihn verarbeitet. Name, E-Mail, Adresse, Foto und weitere persönliche Daten werden entfernt.</p>
            </div>
            <input type="text" placeholder="Name des Kandidaten" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
            <label className="flex items-center gap-3 border-2 border-dashed border-brand-200 rounded-xl p-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
              <UploadIcon size={20} className="text-brand-400" />
              <span className="text-sm text-gray-500">{cvFile ? cvFile.name : 'CV als PDF auswählen...'}</span>
              <input type="file" accept=".pdf" className="hidden" onChange={e => setCvFile(e.target.files[0])} />
            </label>
            <button onClick={handleCvUpload} disabled={loading || !cvFile || !candidateName} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
              {loading ? 'Uploading & anonymizing...' : 'CV hochladen'}
            </button>
          </div>
        )}
        {step === 4 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle size={20} /><h3 className="font-medium">Upload erfolgreich!</h3></div>
            <div className="bg-surface-50 rounded-xl p-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Kandidat:</span> {result.name}</p>
              <p><span className="text-gray-500">ID:</span> <code className="text-xs bg-surface-200 px-1.5 py-0.5 rounded">{result.id.slice(0,8)}...</code></p>
            </div>
            {result.gdpr && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
                <p className="text-xs font-medium text-brand-700 mb-1">DSGVO Anonymisierung</p>
                <p className="text-xs text-brand-600">{result.gdpr.report}</p>
              </div>
            )}
            <button onClick={() => { setStep(3); setCvFile(null); setCandidateName(''); setResult(null) }} className="text-sm text-brand-500 hover:text-brand-700">Weiteren Kandidaten hochladen →</button>
          </div>
        )}
      </div>
    </div>
  )
}
