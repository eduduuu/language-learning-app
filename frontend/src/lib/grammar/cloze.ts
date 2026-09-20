export interface GeneratedCloze {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  originalSentence: string;
  targetParticle: string;
}

const CANDIDATE_PARTICLES = ['に', 'で', 'を', 'へ', 'が', 'は', 'と', 'から', 'まで'];

const PARTICLE_EXPLANATIONS: Record<string, string> = {
  に: '「に」marks a specific time, static location, or destination of motion.',
  で: '「で」marks the location of an active event, or the means/instrument used.',
  を: '「を」marks the direct object of a transitive verb, or path passed through.',
  へ: '「へ」indicates the direction of travel/movement towards a destination.',
  が: '「が」identifies the grammatical subject, especially with sensory or ability words.',
  は: '「は」marks the conversational topic ("As for X...").',
  と: '「と」means "and" (exhaustive noun list) or "with" (together with someone).',
  から: '「から」means "from" (starting point) or "because".',
  まで: '「まで」means "until" or "as far as" (end point).',
};

export function generateLocalSentenceCloze(sentence: string): GeneratedCloze | null {
  const clean = sentence.trim();
  if (clean.length < 6) return null;

  const matches: { particle: string; start: number; end: number }[] = [];

  for (const p of CANDIDATE_PARTICLES) {
    const regex = new RegExp(
      `([\\u4E00-\\u9FAF\\u3040-\\u309F\\u30A0-\\u30FF]+)(${p})([\\u4E00-\\u9FAF\\u3040-\\u309F\\u30A0-\\u30FF])`,
      'g'
    );
    let m: RegExpExecArray | null;
    while ((m = regex.exec(clean)) !== null) {
      matches.push({
        particle: p,
        start: m.index + m[1].length,
        end: m.index + m[1].length + p.length,
      });
    }
  }

  if (matches.length === 0) return null;

  // Pick one target particle at random
  const target = matches[Math.floor(Math.random() * matches.length)];
  const targetParticle = target.particle;

  const maskedSentence =
    clean.slice(0, target.start) + '（　）' + clean.slice(target.end);

  const distractorPool = CANDIDATE_PARTICLES.filter((p) => p !== targetParticle);
  // Shuffle distractor pool
  const shuffledDistractors = distractorPool.sort(() => 0.5 - Math.random()).slice(0, 3);

  const options = [targetParticle, ...shuffledDistractors].sort(() => 0.5 - Math.random());
  const correctIndex = options.indexOf(targetParticle);

  const rule = PARTICLE_EXPLANATIONS[targetParticle] || 'Standard Japanese case particle.';
  const explanation = `The correct particle here is 「${targetParticle}」. ${rule}\nOriginal sentence: 「${clean}」`;

  return {
    question: `次の文の（　）に入る最も適切な助詞を選んでください：\n\n${maskedSentence}`,
    options,
    correct_option_index: correctIndex,
    explanation,
    originalSentence: clean,
    targetParticle,
  };
}
