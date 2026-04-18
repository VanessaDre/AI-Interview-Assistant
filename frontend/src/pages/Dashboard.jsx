import { useState, useEffect } from 'react'
import { Activity, FileText, Users, UserPlus, CheckCircle, AlertCircle, Trash2, Eye, X, ChevronDown, ChevronRight, Download, Sparkles, ShieldCheck, ShieldAlert } from 'lucide-react'
import { healthCheck, getJobDescriptions, getCandidates, getInterviewRounds, deleteJobDescription, deleteCandidate, deleteRound, deleteRoundQuestions, getJdPdfUrl, getJdContent, getCvPdfUrl, getRoundQuestions, exportInterviewKit } from '../services/api'

const SYSTEM_PROTECTED_JD_IDS = ['SYSTEM_KENNENLERN_DEFAULT']
const SYSTEM_PROTECTED_ROUND_IDS = ['SYSTEM_KENNENLERN_ROUND_DEFAULT']

function PdfModal({ url, title, onClose }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <h3 className="font-medium text-gray-700">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-100 rounded-lg"><X size={18} /></button>
        </div>
        <iframe src={url} className="flex-1 rounded-b-2xl" />
      </div>
    </div>
  )
}

// TextModal — renders the plain-text content of system-level JDs that have
// no backing PDF (like the generic 'Kennenlerngespraech'). Shows the exact
// text used as question-generation context so the recruiter can verify the
// basis of the AI-generated interview questions (EU AI Act Art. 13).
function TextModal({ data, onClose }) {
  if (!data) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <div>
            <h3 className="font-medium text-gray-700">{data.title}</h3>
            {data.company && !data.is_system && <p className="text-xs text-gray-400">{data.company}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {data.is_system && (
            <div className="mb-4 p-3 bg-brand-50 border border-brand-100 rounded-lg">
              <p className="text-xs text-brand-700 font-medium mb-1">System-generierte Job Description</p>
              <p className="text-xs text-brand-600">
                Dies ist kein hochgeladenes Dokument, sondern ein systeminterner Kontext-Text,
                den die KI als Basis für Kennenlern-Fragen nutzt.
              </p>
            </div>
          )}
          {data.content ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{data.content}</pre>
          ) : (
            <p className="text-sm text-gray-400 italic">Kein Text-Inhalt verfügbar.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function RubricInline({ rubric }) {
  const [open, setOpen] = useState(false)
  if (!rubric) return null
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-[10px] text-brand-500 hover:text-brand-700">
        {open ? 'Rubric verbergen' : 'Rubric anzeigen'}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {Object.entries(rubric).map(([s, d]) => (
            <div key={s} className="flex gap-1.5 text-[11px]">
              <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-medium ${
                s <= 2 ? 'bg-red-400' : s == 3 ? 'bg-amber-400' : s == 4 ? 'bg-emerald-400' : 'bg-brand-500'
              }`}>{s}</span>
              <span className="text-gray-500">{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewInline({ review }) {
  const [open, setOpen] = useState(false)
  if (!review) return null

  const avg = review.average_score
  const antiDisc = (review.anti_discrimination_check || '').toLowerCase()
  const attempts = review.retry_attempts || 0
  const scores = review.scores || {}
  const reasoning = review.reasoning || ''

  const avgColor =
    avg >= 8 ? 'bg-emerald-100 text-emerald-700' :
    avg >= 7 ? 'bg-brand-50 text-brand-700' :
    avg >= 5 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700'

  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-700">
        {avg !== undefined && (
          <span className={`px-1.5 py-0.5 rounded-full font-medium ${avgColor}`}>QA {avg}/10</span>
        )}
        {antiDisc === 'pass' && (
          <span className="flex items-center gap-0.5 text-emerald-600">
            <ShieldCheck size={10} /> Anti-Diskriminierung ok
          </span>
        )}
        {antiDisc === 'fail' && (
          <span className="flex items-center gap-0.5 text-red-600">
            <ShieldAlert size={10} /> FAIL
          </span>
        )}
        {attempts > 0 && (
          <span className="text-amber-600">· {attempts}× regeneriert</span>
        )}
        <span className="text-brand-500 hover:text-brand-700 ml-auto">
          {open ? 'Details verbergen' : 'Details'}
        </span>
      </button>
      {open && (
        <div className="mt-1 p-2 bg-surface-50 rounded-lg space-y-1">
          {Object.entries(scores).length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {Object.entries(scores).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-700">{v}/10</span>
                </div>
              ))}
            </div>
          )}
          {reasoning && (
            <p className="text-[10px] text-gray-500 pt-1 border-t border-surface-200 italic">
              {reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [health, setHealth] = useState(null)
  const [jds, setJds] = useState([])
  const [allCandidates, setAllCandidates] = useState([])
  const [rounds, setRounds] = useState([])
  const [pdfModal, setPdfModal] = useState(null)
  const [textModal, setTextModal] = useState(null)
  const [jdsOpen, setJdsOpen] = useState(true)
  const [candidatesOpen, setCandidatesOpen] = useState(true)
  const [roundsOpen, setRoundsOpen] = useState(true)
  const [openRoundId, setOpenRoundId] = useState(null)
  const [roundQuestions, setRoundQuestions] = useState({})
  const [showQuestionsFor, setShowQuestionsFor] = useState(null)

  const load = () => {
    healthCheck().then(r => setHealth(r.data)).catch(() => setHealth(null))
    getJobDescriptions().then(r => setJds(r.data)).catch(() => {})
    getCandidates().then(r => setAllCandidates(r.data)).catch(() => {})
    getInterviewRounds().then(r => setRounds(r.data)).catch(() => {})
  }
  useEffect(load, [])

  const handleDeleteJd = async (id, title) => {
    if (!confirm(`"${title}" und ALLE verknuepften Rounds loeschen? Kandidaten bleiben erhalten.`)) return
    await deleteJobDescription(id); load()
  }
  const handleDeleteCandidate = async (id, name) => {
    if (!confirm(`CV von "${name}" loeschen? (DSGVO Art. 17)`)) return
    await deleteCandidate(id); load()
  }
  const handleDeleteRound = async (roundId, title) => {
    if (!confirm(`Round "${title}" loeschen? Kandidaten bleiben erhalten.`)) return
    await deleteRound(roundId); load()
  }
  const handleDeleteQuestions = async (roundId, title) => {
    if (!confirm(`Fragen fuer Round "${title}" loeschen? CVs bleiben erhalten.`)) return
    await deleteRoundQuestions(roundId)
    setRoundQuestions(prev => { const n = {...prev}; delete n[roundId]; return n })
    setShowQuestionsFor(null)
    load()
  }

  const handleViewJd = async (jd, isSystemJd) => {
    if (isSystemJd) {
      try {
        const res = await getJdContent(jd.id)
        setTextModal(res.data)
      } catch {
        setTextModal({ title: jd.title, company: jd.company, content: '', is_system: true })
      }
    } else {
      setPdfModal({ url: getJdPdfUrl(jd.id), title: jd.title })
    }
  }

  const toggleRound = (roundId) => setOpenRoundId(prev => prev === roundId ? null : roundId)

  const loadQuestions = async (roundId) => {
    if (showQuestionsFor === roundId) { setShowQuestionsFor(null); return }
    if (!roundQuestions[roundId]) {
      try {
        const res = await getRoundQuestions(roundId)
        const data = res.data.questions
        const q = data?.questions || data || []
        setRoundQuestions(prev => ({ ...prev, [roundId]: q }))
      } catch { setRoundQuestions(prev => ({ ...prev, [roundId]: [] })) }
    }
    setShowQuestionsFor(roundId)
  }

  const newInPool = allCandidates.filter(c => c.is_unassigned)

  // System entities are internal plumbing — they should only count once they
  // carry real user content. The System-JD never counts (it's a virtual
  // context, not a recruited-for role). The System-Round counts as soon as
  // at least one candidate is assigned to it, because then it represents an
  // actual Kennenlern-conversation the recruiter is running.
  const userJdCount = jds.filter(j => !SYSTEM_PROTECTED_JD_IDS.includes(j.id)).length
  const userRoundCount = rounds.filter(r => {
    if (!SYSTEM_PROTECTED_ROUND_IDS.includes(r.id)) return true
    // System round — only count if it actually has candidates
    return (r.candidate_count || 0) > 0
  }).length

  const cards = [
    { label: 'Job Descriptions', value: userJdCount, icon: FileText, color: 'text-brand-500' },
    { label: 'Interview Rounds', value: userRoundCount, icon: Activity, color: 'text-violet-500' },
    { label: 'Talent Pool', value: allCandidates.length, icon: Users, color: 'text-purple-500' },
    { label: 'Neu im Pool', value: newInPool.length, icon: UserPlus, color: 'text-pink-500' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h2>
      <p className="text-sm text-gray-400 mb-6">Multi-Agent Interview System</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{c.label}</span>
              <c.icon size={18} className={c.color} />
            </div>
            <p className="text-3xl font-bold text-gray-800">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
          <button onClick={() => setJdsOpen(!jdsOpen)} className="flex items-center gap-2 w-full text-left mb-3">
            {jdsOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            <h3 className="text-sm font-medium text-gray-600">Job Descriptions</h3>
            <span className="text-xs text-gray-400 ml-auto">{userJdCount}</span>
          </button>
          {jdsOpen && (
            <div className="space-y-2">
              {jds.length === 0 ? <p className="text-xs text-gray-400">Noch keine JDs</p> :
                jds.map(jd => {
                  const isSystemJd = SYSTEM_PROTECTED_JD_IDS.includes(jd.id)
                  return (
                    <div key={jd.id} className="flex items-center justify-between p-2.5 bg-surface-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-700 truncate">{jd.title}</p>
                          {isSystemJd && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium shrink-0">System</span>
                          )}
                        </div>
                        {!isSystemJd && <p className="text-xs text-gray-400 truncate">{jd.company}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleViewJd(jd, isSystemJd)} className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-500" title="JD ansehen"><Eye size={15} /></button>
                        {!isSystemJd && (
                          <button onClick={() => handleDeleteJd(jd.id, jd.title)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Loeschen"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
          <button onClick={() => setCandidatesOpen(!candidatesOpen)} className="flex items-center gap-2 w-full text-left mb-3">
            {candidatesOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            <h3 className="text-sm font-medium text-gray-600">Talent Pool</h3>
            <span className="text-xs text-gray-400 ml-auto">{allCandidates.length}</span>
          </button>
          {candidatesOpen && (
            <div className="space-y-2">
              {allCandidates.length === 0 ? <p className="text-xs text-gray-400">Noch keine Kandidaten</p> :
                allCandidates.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 bg-surface-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {c.assigned_rounds && c.assigned_rounds.length > 0
                          ? c.assigned_rounds.map(ar => ar.title).join(', ')
                          : 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setPdfModal({ url: getCvPdfUrl(c.id), title: `CV: ${c.name}` })} className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-500" title="CV ansehen"><Eye size={15} /></button>
                      <button onClick={() => handleDeleteCandidate(c.id, c.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Loeschen"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm mb-6">
        <button onClick={() => setRoundsOpen(!roundsOpen)} className="flex items-center gap-2 w-full text-left mb-3">
          {roundsOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          <h3 className="text-sm font-medium text-gray-600">Interview Rounds</h3>
          <span className="text-xs text-gray-400 ml-auto">{userRoundCount}</span>
        </button>
        {roundsOpen && (
          <div className="space-y-2">
            {rounds.length === 0 ? <p className="text-xs text-gray-400">Noch keine Rounds</p> :
              rounds.map(r => {
                const rCandidates = allCandidates.filter(c =>
                  c.assigned_rounds && c.assigned_rounds.some(ar => ar.id === r.id)
                )
                const jd = jds.find(j => j.id === r.job_description_id)
                const isOpen = openRoundId === r.id
                const questions = roundQuestions[r.id] || []
                const isQOpen = showQuestionsFor === r.id
                const isSystemRound = SYSTEM_PROTECTED_ROUND_IDS.includes(r.id)
                return (
                  <div key={r.id} className="rounded-xl border border-surface-200 overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-surface-50">
                      <button onClick={() => toggleRound(r.id)} className="flex items-center gap-1.5 text-left flex-1">
                        {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-700">{r.title}</p>
                            {isSystemRound && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium shrink-0">System</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{jd?.title || ''} · {rCandidates.length} Kandidaten · {r.has_questions ? 'Fragen vorhanden' : 'Keine Fragen'}</p>
                        </div>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        {r.has_questions && (
                          <button onClick={() => window.open(exportInterviewKit(r.id), '_blank')} className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-500" title="DOCX Export"><Download size={15} /></button>
                        )}
                        {!isSystemRound && (
                          <button onClick={() => handleDeleteRound(r.id, r.title)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Round loeschen"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-surface-200 p-3 space-y-2">
                        <p className="text-xs font-medium text-gray-500 pl-1">Kandidaten</p>
                        {rCandidates.length === 0 ? <p className="text-xs text-gray-400 pl-5">Keine Kandidaten</p> :
                          rCandidates.map(c => (
                            <div key={c.id} className="flex items-center justify-between pl-5 py-1.5">
                              <p className="text-sm text-gray-600">{c.name}</p>
                              <div className="flex gap-1">
                                <button onClick={() => setPdfModal({ url: getCvPdfUrl(c.id), title: `CV: ${c.name}` })} className="p-1 hover:bg-brand-50 rounded text-brand-500"><Eye size={13} /></button>
                                <button onClick={() => handleDeleteCandidate(c.id, c.name)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          ))
                        }
                        {r.has_questions && (
                          <div className="pt-2 border-t border-surface-200">
                            <div className="flex items-center justify-between">
                              <button onClick={() => loadQuestions(r.id)} className="flex items-center gap-1.5 pl-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                                {isQOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <Sparkles size={12} /> Generierte Fragen
                              </button>
                              <button onClick={() => handleDeleteQuestions(r.id, r.title)} className="text-[10px] text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50">
                                Fragen loeschen
                              </button>
                            </div>
                            {isQOpen && questions.length > 0 && (
                              <div className="mt-2 pl-3 space-y-2">
                                {questions.map((q, i) => (
                                  <div key={i} className="p-2.5 bg-white rounded-lg border border-surface-200">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs text-gray-700"><span className="text-brand-400 font-medium">F{i + 1}</span> {q.question}</p>
                                      <div className="flex gap-1 shrink-0">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                          q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                          q.difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                        }`}>{q.difficulty}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600">{q.category}</span>
                                      </div>
                                    </div>
                                    {q.category_weight !== undefined && q.category_weight > 0 && (
                                      <p className="text-[10px] text-gray-400 mt-0.5">Gewichtung: {(q.category_weight * 100).toFixed(0)}%</p>
                                    )}
                                    <ReviewInline review={q.review} />
                                    <RubricInline rubric={q.rubric} />
                                  </div>
                                ))}
                              </div>
                            )}
                            {isQOpen && questions.length === 0 && (
                              <p className="text-xs text-gray-400 pl-5 mt-1">Keine Fragen gefunden</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        )}
      </div>

      {health && (
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600 mb-3">System Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'OpenAI Key', ok: health.openai_key_loaded },
              { label: 'Langfuse', ok: health.langfuse_enabled },
              { label: 'DSGVO', ok: health.compliance?.gdpr },
              { label: 'AI Act', ok: health.compliance?.ai_act },
              { label: 'Training Opt-Out', ok: health.compliance?.data_training_opt_out },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                {item.ok ? <CheckCircle size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
                <span className="text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">{health.architecture} · v{health.version}</p>
        </div>
      )}

      <PdfModal url={pdfModal?.url} title={pdfModal?.title} onClose={() => setPdfModal(null)} />
      <TextModal data={textModal} onClose={() => setTextModal(null)} />
    </div>
  )
}