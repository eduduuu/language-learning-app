import { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('reader')

  // --- Reader State & Sliders ---
  const [file, setFile] = useState(null)
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(2)
  const [charsPerPage, setCharsPerPage] = useState(1000)
  const [targetWordsCount, setTargetWordsCount] = useState(2)
  const [sentenceLengthWords, setSentenceLengthWords] = useState(10)
  const [kanjiRatio, setKanjiRatio] = useState(0.3)
  const [complexity, setComplexity] = useState('absolute_beginner')

  // Flashcard State
  const [flashcard, setFlashcard] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerError, setReaderError] = useState(null)

  // --- Grammar State ---
  const [grammarTopic, setGrammarTopic] = useState('beginner_combo')
  const [grammarComplexity, setGrammarComplexity] = useState('absolute_beginner')
  const [grammarData, setGrammarData] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [grammarLoading, setGrammarLoading] = useState(false)
  const [grammarError, setGrammarError] = useState(null)

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

    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';
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
      const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';
      const response = await fetch(`${backendUrl}/grammar/?topic=${grammarTopic}&complexity=${grammarComplexity}`)

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to fetch grammar question')
      }

      const data = await response.json()
      setGrammarData(data)
    } catch (err) {
      setGrammarError(err.message)
    } finally {
      setGrammarLoading(false)
    }
  }

  // Vocabulary Highlighting
  const renderHighlightedSentence = (sentence, targetVocabs) => {
    if (!targetVocabs || targetVocabs.length === 0) return sentence

    // Create a regular expression matching any of the target words
    const pattern = new RegExp(`(${targetVocabs.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
    const parts = sentence.split(pattern)

    return parts.map((part, idx) =>
      targetVocabs.includes(part) ? (
        <span key={idx} style={{ color: '#4dabf7', fontWeight: 'bold', borderBottom: '2px solid #4dabf7' }}>
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Japanese Context Reader 📖</h1>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('reader')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'reader' ? '#4dabf7' : '#333',
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          🎴 Reader Flashcards
        </button>
        <button
          onClick={() => setActiveTab('grammar')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'grammar' ? '#4dabf7' : '#333',
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          ✍️ Grammar Practice
        </button>
      </div>

      {/* --- TAB 1: ANKI FLASHCARD READER --- */}
      {activeTab === 'reader' && (
        <div>
          <form onSubmit={handleFetchFlashcard} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', padding: '1.5rem', border: '1px solid #444', borderRadius: '8px', backgroundColor: '#1e1e1e' }}>
            
            {/* File Input */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Select EPUB File:</label>
              <input type="file" accept=".epub" onChange={(e) => setFile(e.target.files[0])} required />
            </div>

            {/* Page Range Inputs */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Start Page</label>
                <input type="number" min="1" value={startPage} onChange={(e) => setStartPage(Number(e.target.value))} style={{ width: '80px', padding: '0.4rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>End Page</label>
                <input type="number" min="1" value={endPage} onChange={(e) => setEndPage(Number(e.target.value))} style={{ width: '80px', padding: '0.4rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Complexity</label>
                <select value={complexity} onChange={(e) => setComplexity(e.target.value)} style={{ padding: '0.4rem' }}>
                  <option value="absolute_beginner">Absolute Beginner</option>
                  <option value="elementary">Elementary</option>
                </select>
              </div>
            </div>

            {/* Continuous Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Target Words/Card: <strong>{targetWordsCount}</strong>
                </label>
                <input type="range" min="1" max="5" value={targetWordsCount} onChange={(e) => setTargetWordsCount(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Approx Sentence Length: <strong>{sentenceLengthWords} words</strong>
                </label>
                <input type="range" min="5" max="25" step="1" value={sentenceLengthWords} onChange={(e) => setSentenceLengthWords(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Kanji vs Hiragana Ratio: <strong>{Math.round(kanjiRatio * 100)}% Kanji</strong>
                </label>
                <input type="range" min="0.0" max="1.0" step="0.1" value={kanjiRatio} onChange={(e) => setKanjiRatio(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Chars / Page: <strong>{charsPerPage}</strong>
                </label>
                <input type="range" min="500" max="3000" step="250" value={charsPerPage} onChange={(e) => setCharsPerPage(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>

            <button type="submit" disabled={readerLoading || !file} style={{ padding: '0.8rem', fontWeight: 'bold', backgroundColor: '#37b24d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              {readerLoading ? 'Extracting & Generating...' : 'Generate First Flashcard'}
            </button>
          </form>

          {readerError && <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>Error: {readerError}</p>}

          {/* Flashcard Card Display */}
          {flashcard && (
            <div style={{ marginTop: '2rem', padding: '2.5rem', backgroundColor: '#25262b', borderRadius: '12px', border: '1px solid #373a40', textAlign: 'center' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                {renderHighlightedSentence(flashcard.japanese_sentence, flashcard.target_vocabs)}
              </h2>

              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  style={{ padding: '0.6rem 2rem', fontSize: '1rem', backgroundColor: '#fcc419', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Show Translation
                </button>
              ) : (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #444', paddingTop: '1.5rem' }}>
                  <p style={{ fontSize: '1.2rem', fontStyle: 'italic', color: '#ced4da', marginBottom: '1rem' }}>
                    "{flashcard.english_translation}"
                  </p>
                  <p style={{ fontSize: '0.95rem', color: '#909296' }}>
                    <strong>Target Vocabulary:</strong> {flashcard.target_vocabs.join(', ')}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '2rem' }}>
                <button
                  onClick={handleFetchFlashcard}
                  disabled={readerLoading}
                  style={{ padding: '0.75rem 2rem', backgroundColor: '#4dabf7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {readerLoading ? 'Loading Next...' : 'Next Sentence ➔'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: GRAMMAR PRACTICE --- */}
      {activeTab === 'grammar' && (
        <div style={{ padding: '1.5rem', backgroundColor: '#1e1e1e', borderRadius: '8px', border: '1px solid #444' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>Topic:</label>
              <select value={grammarTopic} onChange={(e) => setGrammarTopic(e.target.value)} style={{ padding: '0.5rem' }}>
                <option value="beginner_combo">Beginner Combo</option>
                <option value="particles">Particles (は, が, を, に, で...)</option>
                <option value="politeness">Politeness (~です, ~ます)</option>
                <option value="verb_conjugation">Verb Conjugations</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>Complexity:</label>
              <select value={grammarComplexity} onChange={(e) => setGrammarComplexity(e.target.value)} style={{ padding: '0.5rem' }}>
                <option value="absolute_beginner">Absolute Beginner</option>
                <option value="elementary">Elementary</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleFetchGrammar}
                disabled={grammarLoading}
                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#4dabf7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {grammarLoading ? 'Generating...' : 'Get Question'}
              </button>
            </div>
          </div>

          {grammarError && <p style={{ color: '#ff6b6b' }}>Error: {grammarError}</p>}

          {grammarData && (
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#25262b', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>{grammarData.question}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {grammarData.options.map((option, idx) => {
                  let btnColor = '#2c2e33'
                  if (selectedOption !== null) {
                    if (idx === grammarData.correct_index) btnColor = '#2b8a3e'
                    else if (selectedOption === idx) btnColor = '#c92a2a'
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(idx)}
                      style={{
                        padding: '1rem',
                        textAlign: 'left',
                        backgroundColor: btnColor,
                        color: 'white',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      {idx + 1}. {option}
                    </button>
                  )
                })}
              </div>

              {selectedOption !== null && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#1a1b1e', borderRadius: '6px', borderLeft: '4px solid #4dabf7' }}>
                  <p style={{ margin: 0, color: '#f1f3f5', lineHeight: '1.5' }}>
                    <strong>Explanation:</strong> {grammarData.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App