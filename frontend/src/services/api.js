import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const uploadJD = (file, title, company) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', title)
  fd.append('company', company)
  return api.post('/upload/job-description', fd)
}

export const uploadCV = (file, candidateName, interviewRoundId = null) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('candidate_name', candidateName)
  if (interviewRoundId) {
    fd.append('interview_round_id', interviewRoundId)
  }
  return api.post('/upload/cv', fd)
}

export const assignCandidateToRound = (candidateId, roundId) =>
  api.post(`/candidates/${candidateId}/assign/${roundId}`)

export const unassignCandidateFromRound = (candidateId, roundId) =>
  api.delete(`/candidates/${candidateId}/assign/${roundId}`)

export const createRound = (title, jobDescriptionId) =>
  api.post('/interview-rounds', { title, job_description_id: jobDescriptionId })

export const generateQuestions = (interviewRoundId, cvId, categories = null) =>
  api.post('/generate-questions', { interview_round_id: interviewRoundId, cv_id: cvId, categories })

export const regenerateQuestion = (interviewRoundId, cvId, questionIndex, oldQuestion, category, difficulty) =>
  api.post('/regenerate-question', { interview_round_id: interviewRoundId, cv_id: cvId, question_index: questionIndex, old_question: oldQuestion, category, difficulty })

export const getJobDescriptions = () => api.get('/job-descriptions')
export const getInterviewRounds = (jdId = null) => api.get('/interview-rounds', { params: jdId ? { job_description_id: jdId } : {} })
export const getCandidates = (roundId = null) => api.get('/candidates', { params: roundId ? { interview_round_id: roundId } : {} })
export const getRoundQuestions = (roundId) => api.get(`/interview-rounds/${roundId}/questions`)
export const deleteRoundQuestions = (roundId) => api.delete(`/interview-rounds/${roundId}/questions`)
export const getRoundSettings = (roundId) => api.get(`/round-settings/${roundId}`)
export const getDefaultCategories = () => api.get('/default-categories')
export const getAiDisclosure = () => api.get('/ai-disclosure')
export const getCandidateRights = () => api.get('/candidate-rights')
export const deleteCandidate = (id) => api.delete(`/candidates/${id}`)
export const deleteRoundCandidates = (roundId) => api.delete(`/interview-rounds/${roundId}/candidates`)
export const deleteRound = (roundId) => api.delete(`/interview-rounds/${roundId}`)
export const deleteJobDescription = (jdId) => api.delete(`/job-descriptions/${jdId}`)
export const healthCheck = () => api.get('/health', { baseURL: 'http://127.0.0.1:8000' })
export const getJdPdfUrl = (jdId) => `http://127.0.0.1:8000/api/job-descriptions/${jdId}/pdf`
export const getJdContent = (jdId) => api.get(`/job-descriptions/${jdId}/content`)
export const getCvPdfUrl = (candidateId) => `http://127.0.0.1:8000/api/candidates/${candidateId}/pdf`
export const exportInterviewKit = (roundId) => `http://127.0.0.1:8000/api/export/interview-kit/${roundId}`

export default api