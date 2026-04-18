import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Shield, Loader2, Plus, Trash2, RefreshCw, Download, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getJobDescriptions, getInterviewRounds, getCandidates, generateQuestions, getDefaultCategories, exportInterviewKit, regenerateQuestion, getRoundSettings, assignCandidateToRound } from '../services/api'

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

function ReviewDisplay({ review }) {
  const [open, setOpen] = useState(false)
  if (!review || !review.scores) return null
  const avg = review.average_score
  const scoreColor = avg >= 8 ? 'text-emerald-600' : avg >= 7 ? 'text-brand-600' : 'text-amber-600'
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1">
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Quality Review: <span className={`font-medium ${scoreColor}`}>Ø {avg}/10</span> {open ? 'verbergen' : 'anzeigen'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-xs">
          {Object.entries(review.scores).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
              <span className={`font-medium ${v >= 8 ? 'text-emerald-600' : v >= 7 ? 'text-brand-600' : 'text-amber-600'}`}>{v}/10</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 pt-1 border-t border-surface-200">
            <span className="text-gray-500">Anti-Diskriminierung</span>
            <span className={`font-medium ${review.anti_discrimination_check === 'pass' ? 'text-emerald-600' : 'text-red-600'}`}>
              {review.anti_discrimination_check === 'pass' ? '✓ Pass' : '✗ Fail'}
            </span>
          </div>
          {review.retry_attempts > 0 && (
            <p className="text-gray-400 pt-1">Nach {review.retry_attempts} Retry{review.retry_attempts > 1 ? 's' : ''} akzeptiert</p>
          )}
          {review.reasoning && (
            <p className="text-gray-500 pt-1 italic">{review.reasoning}</p>
          )}
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
  const [assigningCandidate, setAssigningCandidate] = useState(false)
  const [replacingIdx, setReplacingIdx] = useState(null)

  useEffect(() => { getJobDescriptions().then(r => setJds(r.data)).catch(() => {}) }, [])
  useEffect(() => { if (selectedJd) getInterviewRounds(selectedJd).then(r => setRounds(r.data)).catch(() => {}) }, [selectedJd])
  // Load the FULL Talent Pool (no round filter) so recruiters can pick any
  // candidate and assign them on the fly. Assigned-status is derived per-candidate
  // via c.assigned_rounds (see select options below).
  useEffect(() => { if (selectedRound) getCandidates().then(r => setCandidates(r.data)).catch(() => {}) }, [selectedRound])
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

  // When the recruiter picks a candidate from the dropdown we automatically
  // assign them to the current round if they are not already assigned.
  // This keeps the Talent Pool workflow seamless: one click instead of
  // switching to the Upload page.
  const handleSelectCandidate = async (candidateId) => {
    setSelectedCandidate(candidateId)
    if (!candidateId || !selectedRound) return

    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return

    const alreadyAssigned = (candidate.assigned_rounds || []).some(r => r.id === selectedRound)
    if (alreadyAssigned) return

    setAssigningCandidate(true)
    try {
      await assignCandidateToRound(candidateId, selectedRound)
      // Refresh candidate list so assigned_rounds reflects the new state
      const res = await getCandidates()
      setCandidates(res.data)
    } catch (e) {
      alert('Zuweisung fehlgeschlagen: ' + (e.response?.data?.detail || e.message))
      setSelectedCandidate('')
    }
    setAssigningCandidate(false)
  }

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

  const isIntroductory = result?.interview_mode === 'introductory'
  const pipelineLabel = isIntroductory
    ? 'Intro Passthrough → CV Agent → Question Agent → Quality Review'
    : 'JD Agent → CV Agent → Question Agent → Quality Review'

  const flaggedQuestions = result?.flagged_questions || []
  const hasFlagged = flaggedQuestions.length > 0

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
                {rounds.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Kandidat:in
                {assigningCandidate && <span className="ml-2 text-brand-500">· weise zu...</span>}
              </label>
              <select value={selectedCandidate} onChange={e => handleSelectCandidate(e.target.value)} className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm bg-white" disabled={!selectedRound || assigningCandidate}>
                <option value="">Wählen...</option>
                {candidates.map(c => {
                  const assignedRounds = c.assigned_rounds || []
                  const inThisRound = assignedRounds.some(r => r.id === selectedRound)
                  const otherRoundsCount = assignedRounds.filter(r => r.id !== selectedRound).length
                  const round = rounds.find(r => r.id === selectedRound)
                  const questionMarker = inThisRound && round?.has_questions ? ' (Fragen vorhanden)' : ''
                  const suffix = inThisRound
                    ? ` · in dieser Runde${questionMarker}`
                    : otherRoundsCount > 0
                      ? ` · aus Talent Pool (in ${otherRoundsCount} Runde${otherRoundsCount > 1 ? 'n' : ''})`
                      : ' · aus Talent Pool (neu)'
                  return <option key={c.id} value={c.id}>{c.name}{suffix}</option>
                })}
              </select>
              {candidates.length === 0 && selectedRound && (
                <p className="text-xs text-gray-400 mt-1">Talent Pool ist leer. Lade einen Kandidaten über die Upload-Seite hoch.</p>
              )}
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
              <p className="text-xs text-gray-400 mt-1">JD Agent → CV Agent → Question Agent → Quality Review</p>
              <p className="text-xs text-gray-400 mt-0.5">Dauert ca. 20–35 Sekunden (Quality Review mit Retries)</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Quality Summary Bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} /> {result.approved_count ?? result.questions?.length ?? 0} approved
                </span>
                {hasFlagged && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle size={12} /> {flaggedQuestions.length} zur Pruefung markiert
                  </span>
                )}
                <span className="text-xs text-gray-400">{pipelineLabel}</span>
              </div>

              {/* Flagged Questions Panel (Human-in-the-Loop) */}
              {hasFlagged && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} className="text-amber-600" />
                    <h3 className="text-sm font-medium text-amber-800">Human-in-the-Loop: Zu pruefende Fragen</h3>
                  </div>
                  <p className="text-xs text-amber-700 mb-4">
                    Diese Fragen wurden vom Quality Review Agent automatisch aussortiert und erreichen den Recruiter nicht im Hauptkit. Pruefen Sie jede Frage manuell, bevor Sie sie verwenden (EU AI Act Art. 14 – Human Oversight).
                  </p>
                  <div className="space-y-3">
                    {flaggedQuestions.map((q, i) => (
                      <div key={i} className="border border-amber-200 rounded-xl p-4 bg-white/60">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm text-gray-800 font-medium flex-1">
                            <span className="text-amber-500 mr-2">⚠ F</span>{q.question}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${DIFF_COLORS[q.difficulty] || 'bg-gray-100 text-gray-600'}`}>{q.difficulty}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{q.category}</span>
                          <span className="text-xs text-amber-700 font-medium">Grund: {q.flag_reason}</span>
                        </div>
                        <ReviewDisplay review={q.review} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Kit */}
              <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-800">Interview Kit: {result.candidate_name}</h3>
                    <p className="text-xs text-gray-400">{result.approved_count ?? result.questions?.length ?? 0} Fragen · Klick auf eine Frage zum Austauschen</p>
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
                        <ReviewDisplay review={q.review} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {result.compliance && (
                <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Shield size={16} className="text-brand-600" /><span className="text-xs font-medium text-brand-700">EU AI Act Compliance</span></div>
                  <p className="text-xs text-brand-600">{result.compliance.human_oversight_disclaimer}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Model: {result.compliance.audit?.model_used} · Pipeline: {result.compliance.audit?.agents_executed?.length || 4} Agents · Langfuse: {result.compliance.audit?.langfuse_traced ? 'Yes' : 'No'} · PII anonymized: {result.compliance.audit?.pii_anonymized ? 'Yes' : 'No'} · HITL active: {result.compliance.ai_act_metadata?.human_in_the_loop_active ? 'Yes' : 'No'}
                  </p>
                </div>
              )}

              {result.jd_analysis && (
                <details className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
                  <summary className="text-sm font-medium text-gray-600 cursor-pointer">
                    {isIntroductory ? 'Intro Passthrough (Agent 1 – deterministisch)' : 'JD-Analyse (Agent 1)'}
                  </summary>
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


