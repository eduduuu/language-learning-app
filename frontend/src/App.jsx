import { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('reader')
  const [language, setLanguage] = useState('japanese')

  // --- Reader State ---
  const [file, setFile] = useState(null)
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(2)
  const [charsPerPage, setCharsPerPage] = useState(1000)
  const [targetWordsCount, setTargetWordsCount] = useState(2)
  const [sentenceLengthWords, setSentenceLengthWords] = useState(10)
  const [kanjiRatio, setKanjiRatio] = useState(0.3)
  const [complexity, setComplexity] = useState('absolute_beginner')

  // Ghost Upload & Flashcard State
  const [uploadStatus, setUploadStatus] = useState(null)
  const [flashcard, setFlashcard] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerError, setReaderError] = useState(null)

  // --- Grammar State ---
  const [grammarTopic, setGrammarTopic] = useState('particles')
  const [grammarComplexity, setGrammarComplexity] = useState('absolute_beginner')
  const [grammarData, setGrammarData] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [grammarLoading, setGrammarLoading] = useState(false)
  const [grammarError, setGrammarError] = useState(null)

  const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // Ghost Upload Handler
  const handleGhostUpload = async () => {
    if (!file) return
    setReaderLoading(true)
    setReaderError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', language)

    try {
      const res = await fetch(`${backendUrl}/upload-book/`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error("Ghost extraction failed.")
      const data = await res.json()
      setUploadStatus(data)
    } catch (err) {
      setReaderError(err.message)
    } finally {
      setReaderLoading(false)
    }
  }

  // Fetch Next Flashcard
  const handleFetchFlashcard = async (e) => {
    if (e) e.preventDefault()
    if (!file) return

    setReaderLoading(true)
    setReaderError(null)
    setShowAnswer(false)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('start_page', startPage)
    formData.append('end_page', endPage)
    formData.append('chars_per_page', charsPerPage)
    formData.append('target_words_count', targetWordsCount)
    formData.append('sentence_length_words', sentenceLengthWords)
    formData.append('kanji_ratio', kanjiRatio)
    formData.append('complexity', complexity)
    formData.append('language', language)

    try {
      const response = await fetch(`${backendUrl}/flashcard/`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to generate flashcard')
      }

      const data = await response.json()
      setFlashcard(data)
    } catch (err) {
      setReaderError(err.message)
    } finally {
      setReaderLoading(false)
    }
  }

  // Fetch Grammar Question
  const handleFetchGrammar = async () => {
    setGrammarLoading(true)
    setGrammarError(null)
    setSelectedOption(null)

    try {
      const response = await fetch(`${backendUrl}/grammar/?topic=${grammarTopic}&complexity=${grammarComplexity}&language=${language}`)
      if (!response.ok) throw new Error('Failed to fetch grammar question')
      const data = await response.json()
      setGrammarData(data)
    } catch (err) {
      setGrammarError(err.message)
    } finally {
      setGrammarLoading(false)
    }
  }

  // Vocabulary Highlighting
  const renderSentence = (sentence, targetVocabs) => {
    if (!targetVocabs || targetVocabs.length === 0) return sentence
    const pattern = new RegExp(`(${targetVocabs.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
    const parts = sentence.split(pattern)

    return parts.map((part, idx) =>
      targetVocabs.includes(part) ? (
        <span key={idx} className="target-highlight">{part}</span>
      ) : part
    )
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-logo">
          <span>Context Reader</span>
          <span className="brand-badge">PRO</span>
        </div>

        <ul className="nav-menu">
          <li>
            <button 
              className={`nav-item ${activeTab === 'reader' ? 'active' : ''}`}
              onClick={() => setActiveTab('reader')}
            >
              🎴 Flashcard Deck
            </button>
          </li>
          <li>
            <button 
              className={`nav-item ${activeTab === 'grammar' ? 'active' : ''}`}
              onClick={() => setActiveTab('grammar')}
            >
              ✍️ Grammar Practice
            </button>
          </li>
        </ul>

        <div style={{ marginTop: 'auto' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>STUDY LANGUAGE</label>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ marginTop: '0.4rem' }}
          >
            <option value="japanese">Japanese 🇯🇵</option>
            <option value="english">English 🇺🇸</option>
          </select>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'reader' && (
          <div>
            <h1 className="page-title">Contextual Deck Studio</h1>
            <p className="page-subtitle">Upload EPUB/PDFs for ghost vocabulary extraction and smart AI flashcards.</p>

            {/* Controls Panel */}
            <div className="panel-card">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Select Book File (EPUB):</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input type="file" accept=".epub,.pdf" onChange={(e) => setFile(e.target.files[0])} />
                  <button className="btn-secondary" onClick={handleGhostUpload} disabled={!file || readerLoading}>
                    Ghost Extract
                  </button>
                </div>
              </div>

              {uploadStatus && (
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  ✅ {uploadStatus.message} ({uploadStatus.extracted_count} words extracted)
                </div>
              )}

              <div className="control-grid">
                <div className="input-group">
                  <label>Target Words: {targetWordsCount}</label>
                  <input type="range" min="1" max="5" value={targetWordsCount} onChange={(e) => setTargetWordsCount(Number(e.target.value))} />
                </div>
                <div className="input-group">
                  <label>Sentence Length: {sentenceLengthWords} words</label>
                  <input type="range" min="5" max="25" value={sentenceLengthWords} onChange={(e) => setSentenceLengthWords(Number(e.target.value))} />
                </div>
                {language === 'japanese' && (
                  <div className="input-group">
                    <label>Kanji Ratio: {Math.round(kanjiRatio * 100)}%</label>
                    <input type="range" min="0.0" max="1.0" step="0.1" value={kanjiRatio} onChange={(e) => setKanjiRatio(Number(e.target.value))} />
                  </div>
                )}
                <div className="input-group">
                  <label>Level</label>
                  <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                    <option value="absolute_beginner">Beginner</option>
                    <option value="elementary">Elementary</option>
                  </select>
                </div>
              </div>

              <button className="btn-primary" style={{ marginTop: '1.25rem', width: '100%' }} onClick={handleFetchFlashcard} disabled={!file || readerLoading}>
                {readerLoading ? 'Generating Flashcard...' : 'Generate Context Sentence'}
              </button>
            </div>

            {readerError && <p style={{ color: 'var(--error-color)' }}>Error: {readerError}</p>}

            {/* Flashcard View */}
            {flashcard && (
              <div className="flashcard-display">
                <div className="japanese-text">
                  {renderSentence(flashcard.japanese_sentence || flashcard.sentence, flashcard.target_vocabs)}
                </div>

                {!showAnswer ? (
                  <button className="btn-secondary" onClick={() => setShowAnswer(true)}>Show Translation</button>
                ) : (
                  <div>
                    <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      "{flashcard.english_translation || flashcard.translation}"
                    </p>

                    {/* Kanji Deep-Dive Accordion */}
                    {flashcard.first_time_breakdowns && flashcard.first_time_breakdowns.length > 0 && (
                      <div className="kanji-drawer">
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-color)' }}>🔍 Kanji Visual Breakdown</h4>
                        {flashcard.first_time_breakdowns.map((item, idx) => (
                          <div key={idx} className="breakdown-card">
                            <strong>{item.word} ({item.kanji})</strong>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              <strong>Radicals:</strong> {item.radicals} | <strong>Mnemonic:</strong> {item.visual_mnemonic}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '2rem' }}>
                  <button className="btn-primary" onClick={handleFetchFlashcard}>Next Card ➔</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grammar Tab */}
        {activeTab === 'grammar' && (
          <div>
            <h1 className="page-title">Grammar Topic Trainer</h1>
            <p className="page-subtitle">Practice isolated grammar patterns and verb conjugations.</p>

            <div className="panel-card">
              <div className="control-grid">
                <div className="input-group">
                  <label>Grammar Topic</label>
                  <select value={grammarTopic} onChange={(e) => setGrammarTopic(e.target.value)}>
                    <option value="particles">Particles (は, が, を, に, で)</option>
                    <option value="politeness">Politeness (~です, ~ます)</option>
                    <option value="verb_conjugation">Verb Conjugations</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Complexity</label>
                  <select value={grammarComplexity} onChange={(e) => setGrammarComplexity(e.target.value)}>
                    <option value="absolute_beginner">Beginner</option>
                    <option value="elementary">Elementary</option>
                  </select>
                </div>
              </div>

              <button className="btn-primary" style={{ marginTop: '1.25rem' }} onClick={handleFetchGrammar} disabled={grammarLoading}>
                {grammarLoading ? 'Generating...' : 'Get Grammar Question'}
              </button>
            </div>

            {grammarError && <p style={{ color: 'var(--error-color)' }}>Error: {grammarError}</p>}

            {grammarData && (
              <div className="panel-card">
                <h3 style={{ marginBottom: '1.25rem' }}>{grammarData.question}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {grammarData.options.map((option, idx) => {
                    let btnStyle = { background: 'var(--bg-primary)' }
                    if (selectedOption !== null) {
                      if (idx === grammarData.correct_index) btnStyle = { background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }
                      else if (selectedOption === idx) btnStyle = { background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }
                    }

                    return (
                      <button 
                        key={idx} 
                        className="btn-secondary" 
                        style={{ textAlign: 'left', ...btnStyle }}
                        onClick={() => setSelectedOption(idx)}
                      >
                        {idx + 1}. {option}
                      </button>
                    )
                  })}
                </div>

                {selectedOption !== null && (
                  <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '6px', borderLeft: '3px solid var(--accent-color)' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <strong>Explanation:</strong> {grammarData.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App