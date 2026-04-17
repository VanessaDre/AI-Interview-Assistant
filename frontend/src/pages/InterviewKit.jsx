import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Shield, Loader2, Plus, Trash2, RefreshCw, Download, Copy } from 'lucide-react'
import { getJobDescriptions, getInterviewRounds, getCandidates, generateQuestions, getDefaultCategories, exportInterviewKit, regenerateQuestion, getRoundSettings } from '../services/api'

function RubricDisplay({ rubric }) {
  const [open, setOpen] = useState(false)
  if (!rubric) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1">
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Bewertungsskala {open ? 'verbergen' : 'anzeigen'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {Object.entries(rubric).map(([score, desc]) => (
            <div key={score} className="flex gap-2 text-xs">
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white font-medium ${
                score <= 2 ? 'bg-red-400' : score == 3 ? 'bg-amber-400' : score == 4 ? 'bg-emerald-400' : 'bg-brand-500'
              }`}>{score}</span>
              <span className="text-gray-600 leading-relaxed">{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DIFF_COLORS = { easy: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700' }

export default function InterviewKit() {
  const [jds, setJds] = useState([])
  const [rounds, setRounds] = useState([])
  const [candidates, setCandidates] = useState([])
  const [selectedJd, setSelectedJd] = useState('')
  const [selectedRound, setSelectedRound] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [categories, setCategories] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [replacingIdx, setReplacingIdx] = useState(null)

  useEffect(() => { getJobDescriptions().then(r => setJds(r.data)).catch(() => {}) }, [])
  useEffect(() => { if (selectedJd) getInterviewRounds(selectedJd).then(r => setRounds(r.data)).catch(() => {}) }, [selectedJd])
  useEffect(() => { if (selectedRound) getCandidates(selectedRound).then(r => setCandidates(r.data)).catch(() => {}) }, [selectedRound])
  useEffect(() => { getDefaultCategories().then(r => setCategories(r.data.categories)).catch(() => {}) }, [])

  // Load saved round settings when a round is selected
  useEffect(() => {
    if (selectedRound) {
      getRoundSettings(selectedRound).then(r => {
        if (r.data.settings) setCategories(r.data.settings)
      }).catch(() => {})
    }
  }, [selectedRound])

  const updateCat = (i, field, val) => setCategories(prev => prev.map((c, j) => j === i ? { ...c, [field]: val } : c))
  const addCat = () => setCategories(prev => [...prev, { category: '', count: 1, difficulty: 'medium', weight: 0.2 }])
  const removeCat = (i) => setCategories(prev => prev.filter((_, j) => j !== i))

  const getWeight = (questionCategory) => {
    if (!result?.category_weights) return null
    if (result.category_weights[questionCategory] !== undefined) return result.category_weights[questionCategory]
    const qLower = questionCategory.toLowerCase()
    for (const [cat, w] of Object.entries(result.category_weights)) {
      if (cat.toLowerCase().includes(qLower) || qLower.includes(cat.toLowerCase())) return w
    }
    return null
  }

  const handleGenerate = async () => {
    if (!selectedRound || !selectedCandidate) return
    setLoading(true); setResult(null)
    try { const res = await generateQuestions(selectedRound, selectedCandidate, categories); setResult(res.data) }
    catch (e) { alert('Generation failed: ' + (e.response?.data?.detail || e.message)) }
    setLoading(false)
  }

  const handleReplaceQuestion = async (idx, q) => {
    setReplacingIdx(idx)
    try {
      const res = await regenerateQuestion(selectedRound, selectedCandidate, idx, q.question, q.category, q.difficulty)
      setResult(prev => {
        const newQuestions = [...prev.questions]
        newQuestions[idx] = { ...res.data.question, category_weight: getWeight(res.data.question.category) }
        return { ...prev, questions: newQuestions }
      })
    } catch (e) { alert('Failed: ' + (e.response?.data?.detail || e.message)) }
    setReplacingIdx(null)
  }

  const handleDownload = () => { if (selectedRound) window.open(exportInterviewKit(selectedRound), '_blank') }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Interview Kit</h2>
      <p className="text-sm text-gray-400 mb-6">Fragen generieren mit Multi-Agent Pipeline</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600">Auswahl</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Job Description</label>
              <select value={selectedJd} onChange={e => { setSelectedJd(e.target.value); setSelectedRound(''); setSelectedCandidate('') }} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">Wählen...</option>
                {jds.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Interview Round</label>
              <select value={selectedRound} onChange={e => { setSelectedRound(e.target.value); setSelectedCandidate('') }} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" disabled={!selectedJd}>
                <option value="">Wählen...</option>
                {rounds.map(r => <option key={r.id} value={r.id}>{r.title} {r.has_questions ? '(Fragen vorhanden)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Kandidat:in</label>
              <select value={selectedCandidate} onChange={e => setSelectedCandidate(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" disabled={!selectedRound}>
                <option value="">Wählen...</option>
                {candidates.map(c => {
                    const round = rounds.find(r => r.id === selectedRound)
                    return <option key={c.id} value={c.id}>{c.name}{round?.has_questions ? ' (Fragen vorhanden)' : ''}</option>
                })}
              </select>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Kategorien</h3>
              <button onClick={addCat} className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"><Plus size={12} /> Hinzufügen</button>
            </div>
            {categories.map((cat, i) => (
              <div key={i} className="border border-surface-200 rounded-xl p-3 space-y-2 bg-white/50">
                <div className="flex items-center gap-2">
                  <input type="text" value={cat.category} onChange={e => updateCat(i, 'category', e.target.value)} placeholder="Kategoriename" className="flex-1 border border-surface-200 rounded-lg px-2 py-1.5 text-sm" />
                  <button onClick={() => removeCat(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Schwierigkeit</label>
                    <select value={cat.difficulty} onChange={e => updateCat(i, 'difficulty', e.target.value)} className="w-full border border-surface-200 rounded-lg px-2 py-1 text-xs">
                      <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Anzahl Fragen</label>
                    <input type="number" min={1} max={5} value={cat.count} onChange={e => updateCat(i, 'count', parseInt(e.target.value) || 1)} className="w-full border border-surface-200 rounded-lg px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Gewichtung</label>
                    <input type="number" min={0} max={1} step={0.05} value={cat.weight} onChange={e => updateCat(i, 'weight', parseFloat(e.target.value) || 0)} className="w-full border border-surface-200 rounded-lg px-2 py-1 text-xs" />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400">Summe: {(categories.reduce((s, c) => s + (c.weight || 0), 0) * 100).toFixed(0)}% (auto-normalisiert auf 100%)</p>
          </div>

          <button onClick={handleGenerate} disabled={loading || !selectedCandidate} className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl py-3 text-sm font-medium hover:from-brand-600 hover:to-brand-700 disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Pipeline läuft...</> : <><Sparkles size={16} /> Interview Kit generieren</>}
          </button>
        </div>

        <div className="lg:col-span-2">
          {loading && (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-10 text-center shadow-sm">
              <Loader2 size={36} className="animate-spin text-brand-500 mx-auto mb-4" />
              <p className="text-sm text-gray-500">Multi-Agent Pipeline läuft...</p>
              <p className="text-xs text-gray-400 mt-1">JD Agent → CV Agent → Question Agent</p>
              <p className="text-xs text-gray-400 mt-0.5">Dauert ca. 15–25 Sekunden</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-800">Interview Kit: {result.candidate_name}</h3>
                    <p className="text-xs text-gray-400">{result.total_questions} Fragen · Klick auf eine Frage zum Austauschen</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-surface-200 rounded-lg text-gray-600 hover:bg-surface-100 transition-colors"><RefreshCw size={13} /> Alle neu</button>
                    <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all"><Download size={13} /> DOCX</button>
                  </div>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                  {result.category_weights && Object.entries(result.category_weights).map(([cat, w]) => (
                    <span key={cat} className="text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full">{cat}: {(w * 100).toFixed(0)}%</span>
                  ))}
                </div>

                <div className="space-y-3">
                  {result.questions?.map((q, i) => {
                    const weight = getWeight(q.category)
                    const isReplacing = replacingIdx === i
                    return (
                      <div key={i} className="border border-surface-200 rounded-xl p-4 bg-white/50 hover:border-brand-200 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm text-gray-800 font-medium flex-1">
                            <span className="text-brand-400 mr-2">F{i + 1}</span>{q.question}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${DIFF_COLORS[q.difficulty] || 'bg-gray-100 text-gray-600'}`}>{q.difficulty}</span>
                            <button onClick={() => handleReplaceQuestion(i, q)} disabled={isReplacing}
                              className="p-1 hover:bg-brand-50 rounded-lg text-brand-400 hover:text-brand-600 disabled:opacity-40" title="Diese Frage austauschen">
                              {isReplacing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{q.category}</span>
                          {weight !== null && <span className="text-xs text-gray-400">Gewichtung: {(weight * 100).toFixed(0)}%</span>}
                        </div>
                        <RubricDisplay rubric={q.rubric} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {result.compliance && (
                <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Shield size={16} className="text-brand-600" /><span className="text-xs font-medium text-brand-700">EU AI Act Compliance</span></div>
                  <p className="text-xs text-brand-600">{result.compliance.human_oversight_disclaimer}</p>
                  <p className="text-xs text-gray-500 mt-2">Model: {result.compliance.audit?.model_used} · Langfuse: {result.compliance.audit?.langfuse_traced ? 'Yes' : 'No'} · PII anonymized: {result.compliance.audit?.pii_anonymized ? 'Yes' : 'No'}</p>
                </div>
              )}

              {result.jd_analysis && (
                <details className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
                  <summary className="text-sm font-medium text-gray-600 cursor-pointer">JD-Analyse (Agent 1)</summary>
                  <pre className="mt-3 text-xs text-gray-500 overflow-auto whitespace-pre-wrap">{JSON.stringify(result.jd_analysis, null, 2)}</pre>
                </details>
              )}
              {result.cv_analysis && (
                <details className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
                  <summary className="text-sm font-medium text-gray-600 cursor-pointer">CV-Analyse (Agent 2)</summary>
                  <pre className="mt-3 text-xs text-gray-500 overflow-auto whitespace-pre-wrap">{JSON.stringify(result.cv_analysis, null, 2)}</pre>
                </details>
              )}
            </div>
          )}

          {!result && !loading && (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-14 text-center shadow-sm">
              <Sparkles size={36} className="text-brand-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Wähle JD, Round und Kandidat:in</p>
              <p className="text-xs text-gray-400 mt-1">Dann klicke "Interview Kit generieren"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
