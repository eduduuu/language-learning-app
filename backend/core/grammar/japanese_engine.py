import random
import re
from typing import Dict, Any, List, Optional
from .base_engine import BaseGrammarEngine

class JapaneseGrammarEngine(BaseGrammarEngine):
    """
    Japanese Grammar Engine providing rule-based question generation
    and single-sentence cloze generation without calling an external LLM.
    """

    @property
    def language(self) -> str:
        return "japanese"

    def get_supported_categories(self) -> List[str]:
        return ["verbs", "particles", "conjugation", "cloze"]

    # =========================================================================
    # VERB DICTIONARIES FOR ZERO-LLM CONJUGATION & CLASSIFICATION
    # =========================================================================

    ICHIDAN_VERBS = [
        {"dict": "食べる", "reading": "たべる", "meaning": "to eat", "stem": "食べ", "te": "食べて", "polite_past": "食べました", "potential": "食べられる"},
        {"dict": "見る", "reading": "みる", "meaning": "to see / look", "stem": "見", "te": "見て", "polite_past": "見ました", "potential": "見られる"},
        {"dict": "起きる", "reading": "おきる", "meaning": "to wake up", "stem": "起き", "te": "起きて", "polite_past": "起きました", "potential": "起きられる"},
        {"dict": "忘れる", "reading": "わすれる", "meaning": "to forget", "stem": "忘れ", "te": "忘れて", "polite_past": "忘れました", "potential": "忘れられる"},
        {"dict": "教える", "reading": "おしえる", "meaning": "to teach", "stem": "教え", "te": "教えて", "polite_past": "教えました", "potential": "教えられる"},
        {"dict": "覚える", "reading": "おぼえる", "meaning": "to remember", "stem": "覚え", "te": "覚えて", "polite_past": "覚えました", "potential": "覚えられる"},
        {"dict": "始める", "reading": "はじめる", "meaning": "to start", "stem": "始め", "te": "始めて", "polite_past": "始めました", "potential": "始められる"},
        {"dict": "開ける", "reading": "あける", "meaning": "to open", "stem": "開け", "te": "開けて", "polite_past": "開けました", "potential": "開けられる"},
    ]

    GODAN_VERBS = [
        {"dict": "飲む", "reading": "のむ", "meaning": "to drink", "stem": "飲み", "te": "飲んで", "polite_past": "飲みました", "potential": "飲める"},
        {"dict": "書く", "reading": "かく", "meaning": "to write", "stem": "書き", "te": "書いて", "polite_past": "書きました", "potential": "書ける"},
        {"dict": "話す", "reading": "はなす", "meaning": "to speak", "stem": "話し", "te": "話して", "polite_past": "話しました", "potential": "話せる"},
        {"dict": "待つ", "reading": "まつ", "meaning": "to wait", "stem": "待ち", "te": "待って", "polite_past": "待ちました", "potential": "待てる"},
        {"dict": "泳ぐ", "reading": "およぐ", "meaning": "to swim", "stem": "泳ぎ", "te": "泳いで", "polite_past": "泳ぎました", "potential": "泳げる"},
        {"dict": "買う", "reading": "かう", "meaning": "to buy", "stem": "買い", "te": "買って", "polite_past": "買いました", "potential": "買える"},
        {"dict": "立つ", "reading": "たつ", "meaning": "to stand", "stem": "立ち", "te": "立って", "polite_past": "立ちました", "potential": "立てる"},
        {"dict": "頼む", "reading": "たのむ", "meaning": "to ask / request", "stem": "頼み", "te": "頼んで", "polite_past": "頼みました", "potential": "頼める"},
    ]

    GODAN_EXCEPTIONS = [
        {"dict": "走る", "reading": "はしる", "meaning": "to run", "stem": "走り", "te": "走って", "polite_past": "走りました", "potential": "走れる"},
        {"dict": "帰る", "reading": "かえる", "meaning": "to return home", "stem": "帰り", "te": "帰って", "polite_past": "帰りました", "potential": "帰れる"},
        {"dict": "入る", "reading": "はいる", "meaning": "to enter", "stem": "入り", "te": "入って", "polite_past": "入りました", "potential": "入れる"},
        {"dict": "知る", "reading": "しる", "meaning": "to know", "stem": "知り", "te": "知って", "polite_past": "知りました", "potential": "知れる"},
        {"dict": "切る", "reading": "きる", "meaning": "to cut", "stem": "切り", "te": "切って", "polite_past": "切りました", "potential": "切れる"},
    ]

    PARTICLE_RULES = {
        "に": "Marks a specific point in time (七時に), a destination of motion (学校に行く), or a static location of existence (部屋にいる).",
        "で": "Marks the location where an activity/action occurs (図書館で勉強する) or the tool/means used (電車で行く).",
        "を": "Marks the direct object of a transitive verb (ご飯を食べる) or the space passed through (公園を歩く).",
        "へ": "Indicates the general direction or heading of movement towards a place (日本へ行く).",
        "が": "Identifies the grammatical subject, answers question words (だれが), or marks objects of ability/desire (日本語ができる、水がほしい).",
        "は": "Marks the broad conversational topic ('As for X...').",
        "と": "Means 'and' (exhaustive list of nouns) or 'with' (友達と話す).",
        "から": "Means 'from' (starting point in time/space) or 'because'.",
        "まで": "Means 'until' or 'as far as' (endpoint in time/space).",
    }

    # =========================================================================
    # RULE QUESTION GENERATION
    # =========================================================================

    def generate_rule_question(
        self,
        topic_key: str,
        complexity: int = 1
    ) -> Optional[Dict[str, Any]]:
        t = topic_key.lower()

        # 1. Verb classification (Ichidan vs Godan vs Exception)
        if "ichidan" in t or "godan" in t or "group" in t or "classification" in t:
            is_exception = random.random() < 0.4
            if is_exception:
                v = random.choice(self.GODAN_EXCEPTIONS)
                correct_class = "五段動詞 (Godan)"
                correct_idx = 1
                explanation = (
                    f"「{v['dict']}」（{v['reading']}）ends in -iru/-eru, but it is a famous "
                    f"五段 (Godan) exception! Its te-form is 「{v['te']}」 and polite past is 「{v['polite_past']}」."
                )
            else:
                is_ichidan = random.random() < 0.5
                if is_ichidan:
                    v = random.choice(self.ICHIDAN_VERBS)
                    correct_class = "一段動詞 (Ichidan)"
                    correct_idx = 0
                    explanation = (
                        f"「{v['dict']}」（{v['reading']}）is an 一段 (Ichidan / ru-verb). "
                        f"Drop る to form stem: 「{v['stem']}」."
                    )
                else:
                    v = random.choice(self.GODAN_VERBS)
                    correct_class = "五段動詞 (Godan)"
                    correct_idx = 1
                    explanation = (
                        f"「{v['dict']}」（{v['reading']}）is a 五段 (Godan / u-verb). "
                        f"Its stem shifts to the -i column: 「{v['stem']}」."
                    )

            options = ["一段動詞 (Ichidan)", "五段動詞 (Godan)", "不規則動詞 (Irregular: サ変/カ変)", "形容動詞 (Na-adjective)"]
            return {
                "question": f"動詞「{v['dict']}」（{v['reading']} : {v['meaning']}）のグループはどれですか？",
                "options": options,
                "correct_option_index": correct_idx,
                "explanation": explanation,
                "complexity": 2 if is_exception else 1
            }

        # 2. Te-form questions
        if "te" in t or "て" in t:
            pool = self.ICHIDAN_VERBS + self.GODAN_VERBS + self.GODAN_EXCEPTIONS
            v = random.choice(pool)
            correct = v["te"]

            # Distractors
            distractors = []
            if correct.endswith("って"):
                distractors = [v["stem"] + "ちて", v["stem"] + "いで", v["dict"] + "て"]
            elif correct.endswith("んで"):
                distractors = [v["stem"] + "みて", v["stem"] + "って", v["dict"] + "て"]
            elif correct.endswith("いて"):
                distractors = [v["stem"] + "きて", v["stem"] + "いで", v["stem"] + "って"]
            elif correct.endswith("いで"):
                distractors = [v["stem"] + "ぎて", v["stem"] + "いて", v["stem"] + "んで"]
            elif correct.endswith("して"):
                distractors = [v["stem"] + "ないて", v["stem"] + "って", v["stem"] + "ちて"]
            else: # Ichidan
                distractors = [v["dict"] + "て", v["stem"] + "って", v["stem"] + "いで"]

            options = [correct] + distractors[:3]
            random.shuffle(options)
            correct_idx = options.index(correct)

            return {
                "question": f"動詞「{v['dict']}」（{v['reading']} : {v['meaning']}）のテ形（Te-form）はどれですか？",
                "options": options,
                "correct_option_index": correct_idx,
                "explanation": f"「{v['dict']}」のテ形は「{correct}」です。",
                "complexity": 2
            }

        # 3. Polite past (〜ました)
        if "past" in t or "polite" in t or "ました" in t:
            pool = self.ICHIDAN_VERBS + self.GODAN_VERBS + self.GODAN_EXCEPTIONS
            v = random.choice(pool)
            correct = v["polite_past"]

            distractors = [
                v["te"].replace("て", "た").replace("で", "だ"), # plain past
                v["stem"] + "ません", # polite negative
                v["potential"] # potential
            ]
            options = [correct] + distractors
            random.shuffle(options)
            correct_idx = options.index(correct)

            return {
                "question": f"動詞「{v['dict']}」（{v['reading']}）の丁寧語・過去形（Polite Past）はどれですか？",
                "options": options,
                "correct_option_index": correct_idx,
                "explanation": f"「{v['dict']}」の連用形（マス形幹）は「{v['stem']}」なので、過去形は「{correct}」になります。",
                "complexity": 1
            }

        # Default fallback: pick a verb classification question
        return self.generate_rule_question("ichidan_godan", complexity)

    # =========================================================================
    # SINGLE-SENTENCE CLOZE GENERATION (ZERO LLM, 100% LEGAL)
    # =========================================================================

    def generate_sentence_cloze(self, sentence: str) -> Optional[Dict[str, Any]]:
        """
        Takes 1 single sentence from the user's book, detects a target particle,
        masks it, and generates 4 multiple-choice options with a pedagogical explanation.
        """
        clean_sentence = sentence.strip()
        if len(clean_sentence) < 6:
            return None

        # Look for candidate particles in the sentence
        candidate_particles = ["に", "で", "を", "へ", "が", "は", "と", "から", "まで"]

        matches = []
        for p in candidate_particles:
            # Match particle with word before and after
            pattern = re.compile(rf'([\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+)({re.escape(p)})([\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF])')
            for m in pattern.finditer(clean_sentence):
                matches.append({
                    "particle": p,
                    "start": m.start(2),
                    "end": m.end(2),
                    "pre": m.group(1),
                    "post": m.group(3)
                })

        if not matches:
            return None

        # Pick one target particle occurrence
        target = random.choice(matches)
        p_target = target["particle"]

        # Build masked sentence
        masked = clean_sentence[:target["start"]] + "（　）" + clean_sentence[target["end"]:]

        # Select 3 plausible distractors from the particle pool
        distractor_pool = [p for p in candidate_particles if p != p_target]
        distractors = random.sample(distractor_pool, 3)

        options = [p_target] + distractors
        random.shuffle(options)
        correct_idx = options.index(p_target)

        rule = self.PARTICLE_RULES.get(p_target, "Standard Japanese case particle.")
        explanation = (
            f"The correct particle here is 「{p_target}」. {rule}\n"
            f"Original sentence: 「{clean_sentence}」"
        )

        return {
            "question": f"次の文の（　）に入る最も適切な助詞を選んでください：\n\n{masked}",
            "options": options,
            "correct_option_index": correct_idx,
            "explanation": explanation,
            "complexity": 2,
            "masked_target": p_target
        }
