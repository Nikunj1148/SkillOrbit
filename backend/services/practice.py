"""
SkillOrbit Backend — Practice Service
DemoProvider with curated responses + LiveProvider interface for future AI integration.
"""
from abc import ABC, abstractmethod
from typing import Any
import re


class PracticeResult:
    """Result from a practice evaluation."""
    def __init__(
        self,
        passed: bool,
        feedback: str,
        criteria_results: list[dict],
        evaluation_mode: str,
        simulated_response: str | None = None,
        xp_awarded: int = 0,
    ):
        self.passed = passed
        self.feedback = feedback
        self.criteria_results = criteria_results
        self.evaluation_mode = evaluation_mode
        self.simulated_response = simulated_response
        self.xp_awarded = xp_awarded

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "feedback": self.feedback,
            "criteria_results": self.criteria_results,
            "evaluation_mode": self.evaluation_mode,
            "simulated_response": self.simulated_response,
            "xp_awarded": self.xp_awarded,
        }


class PracticeProvider(ABC):
    """Abstract base for practice evaluation providers."""

    @abstractmethod
    async def evaluate_task(
        self, lesson_id: str, user_input: str, language: str, lesson_content: dict
    ) -> PracticeResult:
        """Evaluate a learner's task submission."""
        ...

    @abstractmethod
    async def evaluate_check(
        self, lesson_id: str, check_index: int, selected_index: int, lesson_content: dict
    ) -> PracticeResult:
        """Evaluate an understanding check answer."""
        ...


class DemoProvider(PracticeProvider):
    """
    Curated demo responses with explicit rule-based feedback.
    All responses are labeled as simulated. Criteria checks are transparent.
    """

    async def evaluate_task(
        self, lesson_id: str, user_input: str, language: str, lesson_content: dict
    ) -> PracticeResult:
        """
        Rule-based evaluation of task submissions.
        Checks structural criteria rather than semantic meaning.
        """
        if not user_input or not user_input.strip():
            return PracticeResult(
                passed=False,
                feedback=self._get_empty_feedback(language),
                criteria_results=[{"criterion": "non_empty", "met": False, "reason": "Input was empty"}],
                evaluation_mode="demo_rule_based",
                xp_awarded=0,
            )

        task = lesson_content.get("interactive_task", {})
        criteria_definitions = task.get("evaluation_criteria", [])
        sample_response = task.get("sample_good_response", "")

        criteria_results = self._check_criteria(user_input, criteria_definitions, language)
        met_count = sum(1 for c in criteria_results if c["met"])
        total = len(criteria_results) if criteria_results else 1

        if met_count == total and total > 0:
            passed = True
            feedback_key = "pass"
            xp = 30
        elif met_count >= total / 2:
            passed = False
            feedback_key = "partial"
            xp = 10
        else:
            passed = False
            feedback_key = "fail"
            xp = 0

        feedback_templates = lesson_content.get("feedback_templates", {})
        feedback_text = feedback_templates.get(feedback_key, self._default_feedback(feedback_key, language))

        # Build simulated response based on the sample good response
        simulated = f"[Demo AI — simulated response]\n\n{sample_response}" if sample_response else None

        return PracticeResult(
            passed=passed,
            feedback=f"[Rule-based feedback]\n{feedback_text}",
            criteria_results=criteria_results,
            evaluation_mode="demo_rule_based",
            simulated_response=simulated,
            xp_awarded=xp,
        )

    async def evaluate_check(
        self, lesson_id: str, check_index: int, selected_index: int, lesson_content: dict
    ) -> PracticeResult:
        """Evaluate an understanding check — straightforward correct/incorrect."""
        checks = lesson_content.get("understanding_checks", [])
        if check_index < 0 or check_index >= len(checks):
            return PracticeResult(
                passed=False,
                feedback="Invalid check index.",
                criteria_results=[],
                evaluation_mode="demo_rule_based",
                xp_awarded=0,
            )

        check = checks[check_index]
        correct = check.get("correct_index", 0)
        is_correct = selected_index == correct
        explanation = check.get("explanation", "")

        return PracticeResult(
            passed=is_correct,
            feedback=f"{'✓ Correct!' if is_correct else '✗ Not quite.'} {explanation}",
            criteria_results=[{
                "criterion": "correct_answer",
                "met": is_correct,
                "reason": f"Selected option {selected_index}, correct was {correct}"
            }],
            evaluation_mode="demo_rule_based",
            xp_awarded=10 if is_correct else 0,
        )

    def _check_criteria(self, user_input: str, criteria: list[str], language: str) -> list[dict]:
        """
        Check structural criteria against user input.
        These are honest, limited checks — not semantic understanding.
        """
        results = []
        text = user_input.strip().lower()
        word_count = len(text.split())

        for criterion in criteria:
            criterion_lower = criterion.lower()

            if "length" in criterion_lower or "words" in criterion_lower or "detailed" in criterion_lower:
                met = word_count >= 15
                reason = f"Response has {word_count} words (minimum ~15 expected)" if met else f"Response is short ({word_count} words). Try adding more detail."
            elif "goal" in criterion_lower or "objective" in criterion_lower:
                met = word_count >= 5 and any(w in text for w in ["goal", "want", "need", "should", "लक्ष्य", "చేయాలి", "வேண்டும்", "ಬೇಕು", "purpose", "aim"])
                reason = "Mentions a goal or objective" if met else "Try stating what you want to achieve"
            elif "context" in criterion_lower:
                met = word_count >= 10
                reason = "Provides context" if met else "Add background information or context"
            elif "constraint" in criterion_lower or "format" in criterion_lower:
                met = any(w in text for w in ["format", "constraint", "must", "should not", "limit", "bullet", "list", "प्रारूप", "ఫార్మాట్", "வடிவம்", "ಫಾರ್ಮ್ಯಾಟ್"])
                reason = "Specifies constraints or format" if met else "Try specifying the desired format or constraints"
            elif "example" in criterion_lower:
                met = any(w in text for w in ["example", "for instance", "such as", "like", "उदाहरण", "ఉదాహరణ", "உதாரணம்", "ಉದಾಹರಣೆ"])
                reason = "Includes examples" if met else "Try adding an example to clarify"
            elif "iteration" in criterion_lower or "improve" in criterion_lower:
                met = word_count >= 20
                reason = "Shows iterative improvement" if met else "Try refining your instruction further"
            elif "evidence" in criterion_lower or "claim" in criterion_lower or "verify" in criterion_lower:
                met = any(w in text for w in ["verify", "check", "evidence", "source", "claim", "unsupported", "जाँच", "సరిచూడు", "சரிபார்", "ಪರಿಶೀಲಿಸಿ"])
                reason = "Addresses verification" if met else "Mention how you would verify the claims"
            elif "privacy" in criterion_lower or "personal" in criterion_lower or "safe" in criterion_lower:
                met = any(w in text for w in ["private", "personal", "safe", "protect", "remove", "redact", "गोपनीय", "వ్యక్తిగత", "தனிப்பட்ட", "ಖಾಸಗಿ"])
                reason = "Addresses privacy/safety" if met else "Consider mentioning how to protect personal information"
            elif "professional" in criterion_lower or "tone" in criterion_lower:
                met = word_count >= 10 and "!" not in text[:50]
                reason = "Uses appropriate tone" if met else "Try using a more professional tone"
            elif "action" in criterion_lower or "task" in criterion_lower:
                met = word_count >= 10
                reason = "Identifies actions" if met else "Try identifying specific actions or tasks"
            elif "structure" in criterion_lower or "organized" in criterion_lower:
                met = word_count >= 15 or "\n" in user_input
                reason = "Response is structured" if met else "Try organizing your response with clear structure"
            else:
                # For unrecognized criteria, we honestly say we can't check it
                met = True  # Don't penalize for criteria we can't evaluate
                reason = f"[Limited check] Cannot fully evaluate: '{criterion}'. Marked as met — a live AI would assess this more thoroughly."

            results.append({
                "criterion": criterion,
                "met": met,
                "reason": reason,
            })

        # If no criteria defined, do a basic length check
        if not results:
            results.append({
                "criterion": "response_provided",
                "met": word_count >= 5,
                "reason": f"Response has {word_count} words" if word_count >= 5 else "Please provide a more detailed response",
            })

        return results

    def _get_empty_feedback(self, language: str) -> str:
        msgs = {
            "en": "Please write something before submitting. Even a rough attempt helps you learn!",
            "hi": "कृपया सबमिट करने से पहले कुछ लिखें। एक मोटा प्रयास भी सीखने में मदद करता है!",
            "te": "దయచేసి సమర్పించే ముందు ఏదైనా రాయండి. ఒక ప్రయత్నం కూడా నేర్చుకోవడానికి సహాయపడుతుంది!",
            "ta": "தயவுசெய்து சமர்ப்பிக்கும் முன் எதாவது எழுதுங்கள். ஒரு முயற்சி கூட கற்றுக்கொள்ள உதவும்!",
            "kn": "ದಯವಿಟ್ಟು ಸಲ್ಲಿಸುವ ಮೊದಲು ಏನಾದರೂ ಬರೆಯಿರಿ. ಒಂದು ಪ್ರಯತ್ನವೂ ಕಲಿಯಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ!",
        }
        return msgs.get(language, msgs["en"])

    def _default_feedback(self, key: str, language: str) -> str:
        defaults = {
            "pass": {
                "en": "Great work! You've met all the criteria for this task.",
                "hi": "बहुत बढ़िया! आपने इस कार्य के सभी मानदंड पूरे किए हैं।",
                "te": "అద్భుతం! మీరు ఈ పని యొక్క అన్ని ప్రమాణాలను పూర్తి చేసారు.",
                "ta": "அருமை! இந்த பணிக்கான அனைத்து அளவுகோல்களையும் நிறைவேற்றிவிட்டீர்கள்.",
                "kn": "ಅದ್ಭುತ! ನೀವು ಈ ಕಾರ್ಯದ ಎಲ್ಲಾ ಮಾನದಂಡಗಳನ್ನು ಪೂರೈಸಿದ್ದೀರಿ.",
            },
            "partial": {
                "en": "Good effort! You've met some criteria. Review the feedback and try again.",
                "hi": "अच्छा प्रयास! आपने कुछ मानदंड पूरे किए हैं। फीडबैक देखें और फिर से कोशिश करें।",
                "te": "మంచి ప్రయత్నం! మీరు కొన్ని ప్రమాణాలను పూర్తి చేసారు. అభిప్రాయాన్ని సమీక్షించి మళ్ళీ ప్రయత్నించండి.",
                "ta": "நல்ல முயற்சி! சில அளவுகோல்களை நிறைவேற்றியுள்ளீர்கள். கருத்தை மதிப்பாய்வு செய்து மீண்டும் முயற்சிக்கவும்.",
                "kn": "ಒಳ್ಳೆಯ ಪ್ರಯತ್ನ! ನೀವು ಕೆಲವು ಮಾನದಂಡಗಳನ್ನು ಪೂರೈಸಿದ್ದೀರಿ. ಪ್ರತಿಕ್ರಿಯೆ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
            },
            "fail": {
                "en": "Keep trying! Review the hints and the worked example, then give it another go.",
                "hi": "कोशिश जारी रखें! संकेत और उदाहरण देखें, फिर दोबारा प्रयास करें।",
                "te": "ప్రయత్నిస్తూ ఉండండి! సూచనలు మరియు ఉదాహరణ చూడండి, మళ్ళీ ప్రయత్నించండి.",
                "ta": "முயற்சியைத் தொடருங்கள்! குறிப்புகளையும் உதாரணத்தையும் பாருங்கள், மீண்டும் முயற்சிக்கவும்.",
                "kn": "ಪ್ರಯತ್ನಿಸುತ್ತಿರಿ! ಸುಳಿವುಗಳು ಮತ್ತು ಉದಾಹರಣೆ ನೋಡಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
            },
        }
        return defaults.get(key, defaults["fail"]).get(language, defaults.get(key, defaults["fail"])["en"])


class LiveProvider(PracticeProvider):
    """
    Extension point for future live AI integration.
    NOT enabled in the demo — raises an error if called.

    To implement:
    1. Configure AI_PROVIDER=live in .env
    2. Set API key and rate limits
    3. Override evaluate_task/evaluate_check with actual AI calls
    4. Add timeouts, rate limiting, per-user quotas, and spending controls
    """

    async def evaluate_task(
        self, lesson_id: str, user_input: str, language: str, lesson_content: dict
    ) -> PracticeResult:
        raise NotImplementedError(
            "Live AI provider is not configured. "
            "Set AI_PROVIDER=demo in .env for the demo, or implement "
            "LiveProvider with your AI service credentials."
        )

    async def evaluate_check(
        self, lesson_id: str, check_index: int, selected_index: int, lesson_content: dict
    ) -> PracticeResult:
        raise NotImplementedError("Live AI provider is not configured.")


def get_provider(provider_name: str = "demo") -> PracticeProvider:
    """Factory function to get the appropriate practice provider."""
    if provider_name == "demo":
        return DemoProvider()
    elif provider_name == "live":
        return LiveProvider()
    else:
        raise ValueError(f"Unknown provider: {provider_name}. Use 'demo' or 'live'.")
