import { useState, useEffect } from 'react'
import { Upload as UploadIcon, CheckCircle, ChevronRight, Shield, Users, Briefcase, UserPlus, ChevronDown, ChevronUp, FileSearch } from 'lucide-react'
import { uploadJD, uploadCV, createRound, getJobDescriptions, getInterviewRounds, getCandidates, assignCandidateToRound } from '../services/api'

function StepBadge({ num, active, done }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
      done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-gray-400'
    }`}>{done ? <CheckCircle size={16} /> : num}</div>
  )
}

function AnalysisSection({ title, items }) {
  if (!items || (Array.isArray(items) && items.length === 0)) return null
  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-brand-700 mb-1">{title}</p>
      {Array.isArray(items) ? (
        <ul className="space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-1.5">
              <span className="text-brand-400">·</span>
              <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-600">{String(items)}</p>
      )}
    </div>
  )
}

function AnalysisPanel({ analysis, type }) {
  const [open, setOpen] = useState(false)
  if (!analysis) {
    return (
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-xs text-gray-500">
        Analyse konnte nicht erzeugt werden. Upload ist erfolgreich, Fragen koennen trotzdem generiert werden.
      </div>
    )
  }

  const isJD = type === 'jd'
  const title = isJD ? 'JD-Analyse' : 'CV-Analyse'
  const subtitle = isJD
    ? 'Der JD Analyst hat folgende Struktur aus der Stelle extrahiert'
    : 'Der CV Analyst hat folgende Struktur aus dem Lebenslauf extrahiert'

  return (
    <div className="bg-white border border-brand-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileSearch size={16} className="text-brand-600" />
          <div className="text-left">
            <p className="text-sm font-medium text-brand-700">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-brand-600" /> : <ChevronDown size={16} className="text-brand-600" />}
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-brand-100 bg-brand-50/30">
          {isJD ? (
            <>
              {analysis.role_title && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-brand-700 mb-1">Rolle</p>
                  <p className="text-xs text-gray-700">{analysis.role_title}</p>
                </div>
              )}
              {analysis.experience_level && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-brand-700 mb-1">Seniority</p>
                  <p className="text-xs text-gray-700">{analysis.experience_level}</p>
                </div>
              )}
              <AnalysisSection title="Verantwortlichkeiten" items={analysis.key_responsibilities} />
              <AnalysisSection title="Hard Skills" items={analysis.required_hard_skills} />
              <AnalysisSection title="Soft Skills" items={analysis.required_soft_skills} />
              <AnalysisSection title="Nice-to-have" items={analysis.nice_to_have} />
            </>
          ) : (
            <>
              {analysis.experience_level && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-brand-700 mb-1">Erfahrungsstand</p>
                  <p className="text-xs text-gray-700">{analysis.experience_level}</p>
                </div>
              )}
              <AnalysisSection title="Hard Skills" items={analysis.hard_skills} />
              <AnalysisSection title="Soft Skills" items={analysis.soft_skills} />
              <AnalysisSection title="Erfahrung" items={analysis.work_experience} />
              <AnalysisSection title="Ausbildung" items={analysis.education} />
              <AnalysisSection title="Projekte" items={analysis.projects} />
              <AnalysisSection title="Zertifikate" items={analysis.certifications} />
              <AnalysisSection title="Sprachen" items={analysis.languages} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function UploadPage() {
  const [mode, setMode] = useState(null)
  const [step, setStep] = useState(1)
  const [jds, setJds] = useState([])
  const [rounds, setRounds] = useState([])
  const [talentPool, setTalentPool] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [jdResult, setJdResult] = useState(null)
  const [jdFile, setJdFile] = useState(null)
  const [jdTitle, setJdTitle] = useState('')
  const [jdCompany, setJdCompany] = useState('')
  const [selectedJd, setSelectedJd] = useState(null)
  const [roundTitle, setRoundTitle] = useState('')
  const [selectedRound, setSelectedRound] = useState(null)
  const [cvFile, setCvFile] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [cvSource, setCvSource] = useState('new')
  const [selectedTalentPoolId, setSelectedTalentPoolId] = useState('')

  useEffect(() => {
    getJobDescriptions().then(r => setJds(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedJd) getInterviewRounds(selectedJd).then(r => setRounds(r.data)).catch(() => {})
  }, [selectedJd])

  useEffect(() => {
    if (step === 3) {
      getCandidates().then(r => {
        setTalentPool(r.data || [])
      }).catch(() => {})
    }
  }, [step])

  const handleJdUpload = async () => {
    if (!jdFile || !jdTitle || !jdCompany) return
    setLoading(true)
    try {
      const res = await uploadJD(jdFile, jdTitle, jdCompany)
      setSelectedJd(res.data.id)
      setJds(p => [...p, res.data])
      setJdResult(res.data)
      setStep(2)
    }
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
    if (!cvFile || !candidateName) return
    if (mode === 'standard' && !selectedRound) return
    setLoading(true)
    try {
      const res = await uploadCV(cvFile, candidateName, mode === 'standard' ? selectedRound : null)
      setResult(res.data)
      setStep(4)
    }
    catch (e) { alert('Upload failed: ' + (e.response?.data?.detail || e.message)) }
    setLoading(false)
  }

  const handleAssignFromPool = async () => {
    if (!selectedTalentPoolId || !selectedRound) return
    setLoading(true)
    try {
      const candidate = talentPool.find(c => c.id === selectedTalentPoolId)
      await assignCandidateToRound(selectedTalentPoolId, selectedRound)
      setResult({
        id: selectedTalentPoolId,
        name: candidate?.name || 'Kandidat',
        fromTalentPool: true,
      })
      setStep(4)
    }
    catch (e) {
      const errorMsg = e.response?.data?.detail || e.message
      if (e.response?.status === 409) {
        alert('Dieser Kandidat ist bereits in dieser Runde zugewiesen.')
      } else {
        alert('Zuweisung fehlgeschlagen: ' + errorMsg)
      }
    }
    setLoading(false)
  }

  const resetForm = () => {
    setStep(1)
    setCvFile(null)
    setCandidateName('')
    setResult(null)
    setJdFile(null)
    setJdTitle('')
    setJdCompany('')
    setJdResult(null)
    setRoundTitle('')
    setSelectedJd(null)
    setSelectedRound(null)
    setCvSource('new')
    setSelectedTalentPoolId('')
  }

  const backToModeSelect = () => {
    resetForm()
    setMode(null)
  }

  if (!mode) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Upload</h2>
        <p className="text-sm text-gray-400 mb-6">Waehlen Sie Ihren Workflow</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <button
            onClick={() => setMode('standard')}
            className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-6 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left group"
          >
            <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
              <Briefcase size={24} className="text-brand-600" />
            </div>
            <h3 className="font-medium text-gray-800 mb-1">Interview mit Stellenbezug</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Job Description hochladen, Interview-Runde erstellen und Kandidaten zuweisen. Klassischer Recruiter-Workflow.
            </p>
          </button>
          <button
            onClick={() => setMode('talent_pool')}
            className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-6 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left group"
          >
            <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
              <Users size={24} className="text-brand-600" />
            </div>
            <h3 className="font-medium text-gray-800 mb-1">Kandidat ohne Stelle</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Direkt CV hochladen, ohne Stelle oder Runde. Fuer Kennenlerngespraeche und Headhunting. Kandidat kann spaeter einer Runde zugewiesen werden.
            </p>
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'talent_pool') {
    return (
      <div>
        <div className="flex items-center gap-2 mb-1">
          <button onClick={backToModeSelect} className="text-sm text-gray-400 hover:text-brand-600">← Workflow wechseln</button>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Kandidat in Talent Pool aufnehmen</h2>
        <p className="text-sm text-gray-400 mb-6">Direkt-Upload ohne Stellenzuweisung</p>
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-6 max-w-xl shadow-sm">
          {step < 4 && (
            <div className="space-y-4">
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-2">
                <Shield size={16} className="text-brand-600 mt-0.5 shrink-0" />
                <p className="text-xs text-brand-700">DSGVO: Der CV wird automatisch anonymisiert bevor die KI ihn verarbeitet. Name, E-Mail, Adresse, Foto und weitere persoenliche Daten werden entfernt.</p>
              </div>
              <input type="text" placeholder="Name des Kandidaten" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <label className="flex items-center gap-3 border-2 border-dashed border-brand-200 rounded-xl p-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                <UploadIcon size={20} className="text-brand-400" />
                <span className="text-sm text-gray-500">{cvFile ? cvFile.name : 'CV als PDF auswaehlen...'}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setCvFile(e.target.files[0])} />
              </label>
              <button onClick={handleCvUpload} disabled={loading || !cvFile || !candidateName} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                {loading ? 'Uploading, anonymizing & analyzing...' : 'CV in Talent Pool hochladen'}
              </button>
            </div>
          )}
          {step === 4 && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600"><CheckCircle size={20} /><h3 className="font-medium">Upload erfolgreich!</h3></div>
              <div className="bg-surface-50 rounded-xl p-4 space-y-2 text-sm">
                <p><span className="text-gray-500">Kandidat:</span> {result.name}</p>
                <p><span className="text-gray-500">Status:</span> <span className="text-brand-600 font-medium">Talent Pool (keine Runde)</span></p>
                <p><span className="text-gray-500">ID:</span> <code className="text-xs bg-surface-200 px-1.5 py-0.5 rounded">{result.id.slice(0,8)}...</code></p>
              </div>
              {result.gdpr && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-brand-700 mb-1">DSGVO Anonymisierung</p>
                  <p className="text-xs text-brand-600">{result.gdpr.report}</p>
                </div>
              )}
              <AnalysisPanel analysis={result.analysis} type="cv" />
              <div className="flex gap-2">
                <button onClick={resetForm} className="text-sm text-brand-500 hover:text-brand-700">Weiteren Kandidaten hochladen →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const selectedCandidate = talentPool.find(c => c.id === selectedTalentPoolId)
  const selectedCandidateRounds = selectedCandidate?.assigned_rounds || []

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <button onClick={backToModeSelect} className="text-sm text-gray-400 hover:text-brand-600">← Workflow wechseln</button>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Interview mit Stellenbezug</h2>
      <p className="text-sm text-gray-400 mb-6">Job Description und CV hochladen</p>
      <div className="flex items-center gap-3 mb-6">
        {[1,2,3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <StepBadge num={n} active={step === n} done={step > n} />
            <span className={`text-sm ${step === n ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
              {n === 1 ? 'Job Description' : n === 2 ? 'Interview Round' : 'Kandidat'}
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
                <label className="text-xs text-gray-500 mb-1 block">Bestehende JD waehlen:</label>
                <select className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" onChange={e => { setSelectedJd(e.target.value); if(e.target.value) setStep(2) }} value={selectedJd || ''}>
                  <option value="">Neue JD hochladen...</option>
                  {jds.map(j => <option key={j.id} value={j.id}>{j.title}{j.company && j.company !== 'System Default' ? ` – ${j.company}` : ''}</option>)}
                </select>
              </div>
            )}
            <div className="border-t border-surface-200 pt-4 space-y-3">
              <input type="text" placeholder="Jobtitel" value={jdTitle} onChange={e => setJdTitle(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <input type="text" placeholder="Unternehmen" value={jdCompany} onChange={e => setJdCompany(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <label className="flex items-center gap-3 border-2 border-dashed border-brand-200 rounded-xl p-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                <UploadIcon size={20} className="text-brand-400" />
                <span className="text-sm text-gray-500">{jdFile ? jdFile.name : 'PDF auswaehlen...'}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setJdFile(e.target.files[0])} />
              </label>
              <button onClick={handleJdUpload} disabled={loading || !jdFile} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                {loading ? 'Uploading & analyzing...' : 'JD hochladen'}
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Schritt 2: Interview Round</h3>
            {jdResult?.analysis && (
              <AnalysisPanel analysis={jdResult.analysis} type="jd" />
            )}
            {rounds.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bestehende Round waehlen:</label>
                <select className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" onChange={e => { setSelectedRound(e.target.value); if(e.target.value) setStep(3) }} value={selectedRound || ''}>
                  <option value="">Neue Round erstellen...</option>
                  {rounds.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
            <div className="border-t border-surface-200 pt-4 space-y-3">
              <input type="text" placeholder='z.B. "Python Dev – Maerz 2026"' value={roundTitle} onChange={e => setRoundTitle(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
              <button onClick={handleCreateRound} disabled={loading || !roundTitle} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                {loading ? 'Erstelle...' : 'Round erstellen'}
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Schritt 3: Kandidat</h3>

            <div className="flex gap-2 p-1 bg-surface-100 rounded-xl">
              <button
                onClick={() => setCvSource('new')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  cvSource === 'new' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UploadIcon size={14} /> Neuer CV
              </button>
              <button
                onClick={() => setCvSource('pool')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  cvSource === 'pool' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserPlus size={14} /> Aus Talent Pool
                {talentPool.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-600 rounded-full">{talentPool.length}</span>
                )}
              </button>
            </div>

            {cvSource === 'new' && (
              <>
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-2">
                  <Shield size={16} className="text-brand-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-brand-700">DSGVO: Der CV wird automatisch anonymisiert bevor die KI ihn verarbeitet. Name, E-Mail, Adresse, Foto und weitere persoenliche Daten werden entfernt.</p>
                </div>
                <input type="text" placeholder="Name des Kandidaten" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm" />
                <label className="flex items-center gap-3 border-2 border-dashed border-brand-200 rounded-xl p-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                  <UploadIcon size={20} className="text-brand-400" />
                  <span className="text-sm text-gray-500">{cvFile ? cvFile.name : 'CV als PDF auswaehlen...'}</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => setCvFile(e.target.files[0])} />
                </label>
                <button onClick={handleCvUpload} disabled={loading || !cvFile || !candidateName} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                  {loading ? 'Uploading, anonymizing & analyzing...' : 'CV hochladen'}
                </button>
              </>
            )}

            {cvSource === 'pool' && (
              <>
                {talentPool.length === 0 ? (
                  <div className="bg-surface-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Talent Pool ist leer</p>
                    <p className="text-xs text-gray-400">Lade zuerst einen Kandidaten ueber "Kandidat ohne Stelle" hoch, oder nutze "Neuer CV".</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-2">
                      <Users size={14} className="text-brand-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-brand-700">Kandidaten bleiben dauerhaft im Talent Pool und koennen mehreren Runden zugewiesen werden.</p>
                    </div>
                    <label className="text-xs text-gray-500 mb-1 block">Kandidat aus Talent Pool waehlen:</label>
                    <select
                      className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white"
                      value={selectedTalentPoolId}
                      onChange={e => setSelectedTalentPoolId(e.target.value)}
                    >
                      <option value="">Kandidat waehlen...</option>
                      {talentPool.map(c => {
                        const assignedRounds = c.assigned_rounds || []
                        const alreadyInThisRound = assignedRounds.some(r => r.id === selectedRound)
                        const roundCount = assignedRounds.length
                        const label = alreadyInThisRound
                          ? `${c.name} · bereits in dieser Runde`
                          : roundCount === 0
                            ? `${c.name} · neu im Pool`
                            : `${c.name} · in ${roundCount} Runde${roundCount > 1 ? 'n' : ''}`
                        return (
                          <option key={c.id} value={c.id} disabled={alreadyInThisRound}>
                            {label}
                          </option>
                        )
                      })}
                    </select>

                    {selectedTalentPoolId && selectedCandidateRounds.length > 0 && (
                      <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-xs text-gray-600">
                        <p className="font-medium mb-1 text-gray-700">Aktuelle Runden-Zuordnungen:</p>
                        <ul className="space-y-0.5">
                          {selectedCandidateRounds.map(r => <li key={r.id}>· {r.title}</li>)}
                        </ul>
                      </div>
                    )}

                    <button onClick={handleAssignFromPool} disabled={loading || !selectedTalentPoolId} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm">
                      {loading ? 'Weise zu...' : 'Kandidat zur Runde zuweisen'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {step === 4 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle size={20} />
              <h3 className="font-medium">{result.fromTalentPool ? 'Zuweisung erfolgreich!' : 'Upload erfolgreich!'}</h3>
            </div>
            <div className="bg-surface-50 rounded-xl p-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Kandidat:</span> {result.name}</p>
              {result.fromTalentPool ? (
                <p><span className="text-gray-500">Aktion:</span> <span className="text-brand-600 font-medium">Aus Talent Pool zugewiesen</span></p>
              ) : (
                <p><span className="text-gray-500">ID:</span> <code className="text-xs bg-surface-200 px-1.5 py-0.5 rounded">{result.id?.slice(0,8)}...</code></p>
              )}
            </div>
            {result.gdpr && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
                <p className="text-xs font-medium text-brand-700 mb-1">DSGVO Anonymisierung</p>
                <p className="text-xs text-brand-600">{result.gdpr.report}</p>
              </div>
            )}
            {!result.fromTalentPool && <AnalysisPanel analysis={result.analysis} type="cv" />}
            <button onClick={() => { setStep(3); setCvFile(null); setCandidateName(''); setResult(null); setSelectedTalentPoolId('') }} className="text-sm text-brand-500 hover:text-brand-700">Weiteren Kandidaten →</button>
          </div>
        )}
      </div>
    </div>
  )
}

