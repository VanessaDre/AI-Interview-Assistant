import { useState, useEffect } from 'react'
import { Activity, FileText, Users, CheckCircle, AlertCircle, Trash2, Eye, X, ChevronDown, ChevronRight, Download, Sparkles } from 'lucide-react'
import { healthCheck, getJobDescriptions, getCandidates, getInterviewRounds, deleteJobDescription, deleteCandidate, deleteRound, deleteRoundQuestions, getJdPdfUrl, getCvPdfUrl, getRoundQuestions, exportInterviewKit } from '../services/api'

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

export default function Dashboard() {
  const [health, setHealth] = useState(null)
  const [jds, setJds] = useState([])
  const [allCandidates, setAllCandidates] = useState([])
  const [rounds, setRounds] = useState([])
  const [pdfModal, setPdfModal] = useState(null)
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
    if (!confirm(`"${title}" und ALLE verknuepften Rounds + CVs loeschen?`)) return
    await deleteJobDescription(id); load()
  }
  const handleDeleteCandidate = async (id, name) => {
    if (!confirm(`CV von "${name}" loeschen? (DSGVO Art. 17)`)) return
    await deleteCandidate(id); load()
  }
  const handleDeleteRound = async (roundId, title) => {
    if (!confirm(`Round "${title}" und alle CVs darin komplett loeschen?`)) return
    await deleteRound(roundId); load()
  }
  const handleDeleteQuestions = async (roundId, title) => {
    if (!confirm(`Fragen fuer Round "${title}" loeschen? CVs bleiben erhalten.`)) return
    await deleteRoundQuestions(roundId)
    setRoundQuestions(prev => { const n = {...prev}; delete n[roundId]; return n })
    setShowQuestionsFor(null)
    load()
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

  const cards = [
    { label: 'Job Descriptions', value: jds.length, icon: FileText, color: 'text-brand-500' },
    { label: 'Interview Rounds', value: rounds.length, icon: Activity, color: 'text-violet-500' },
    { label: 'Kandidaten', value: allCandidates.length, icon: Users, color: 'text-purple-500' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h2>
      <p className="text-sm text-gray-400 mb-6">Multi-Agent Interview System</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
            <span className="text-xs text-gray-400 ml-auto">{jds.length}</span>
          </button>
          {jdsOpen && (
            <div className="space-y-2">
              {jds.length === 0 ? <p className="text-xs text-gray-400">Noch keine JDs</p> :
                jds.map(jd => (
                  <div key={jd.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{jd.title}</p>
                      <p className="text-xs text-gray-400">{jd.company}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setPdfModal({ url: getJdPdfUrl(jd.id), title: jd.title })} className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-500" title="PDF ansehen"><Eye size={15} /></button>
                      <button onClick={() => handleDeleteJd(jd.id, jd.title)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Loeschen"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/50 p-5 shadow-sm">
          <button onClick={() => setCandidatesOpen(!candidatesOpen)} className="flex items-center gap-2 w-full text-left mb-3">
            {candidatesOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            <h3 className="text-sm font-medium text-gray-600">Kandidaten</h3>
            <span className="text-xs text-gray-400 ml-auto">{allCandidates.length}</span>
          </button>
          {candidatesOpen && (
            <div className="space-y-2">
              {allCandidates.length === 0 ? <p className="text-xs text-gray-400">Noch keine Kandidaten</p> :
                allCandidates.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{c.name}</p>
                      <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                    <div className="flex gap-1">
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
          <span className="text-xs text-gray-400 ml-auto">{rounds.length}</span>
        </button>
        {roundsOpen && (
          <div className="space-y-2">
            {rounds.length === 0 ? <p className="text-xs text-gray-400">Noch keine Rounds</p> :
              rounds.map(r => {
                const rCandidates = allCandidates.filter(c => c.interview_round_id === r.id)
                const jd = jds.find(j => j.id === r.job_description_id)
                const isOpen = openRoundId === r.id
                const questions = roundQuestions[r.id] || []
                const isQOpen = showQuestionsFor === r.id
                return (
                  <div key={r.id} className="rounded-xl border border-surface-200 overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-surface-50">
                      <button onClick={() => toggleRound(r.id)} className="flex items-center gap-1.5 text-left flex-1">
                        {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        <div>
                          <p className="text-sm font-medium text-gray-700">{r.title}</p>
                          <p className="text-xs text-gray-400">{jd?.title || ''} · {rCandidates.length} Kandidaten · {r.has_questions ? 'Fragen vorhanden' : 'Keine Fragen'}</p>
                        </div>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        {r.has_questions && (
                          <button onClick={() => window.open(exportInterviewKit(r.id), '_blank')} className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-500" title="DOCX Export"><Download size={15} /></button>
                        )}
                        <button onClick={() => handleDeleteRound(r.id, r.title)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Round loeschen"><Trash2 size={15} /></button>
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
    </div>
  )
}