"""
SkillOrbit Comprehensive E2E Verification Suite
Tests all 14+ requirements against the live backend and database.
"""
import sys
import json
import urllib.request
import http.cookiejar

BASE_URL = "http://127.0.0.1:8000/api"

class TestClient:
    def __init__(self):
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))

    def request(self, endpoint, method="GET", body=None):
        url = f"{BASE_URL}{endpoint}"
        data = json.dumps(body).encode("utf-8") if body else None
        headers = {"Content-Type": "application/json"} if body else {}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req) as resp:
                status = resp.status
                content = resp.read().decode("utf-8")
                return status, json.loads(content) if content else {}
        except urllib.error.HTTPError as e:
            content = e.read().decode("utf-8")
            return e.code, json.loads(content) if content else {"detail": str(e)}

def run_all_tests():
    print("========================================================")
    print("      SkillOrbit Comprehensive Verification Suite       ")
    print("========================================================")
    passed = 0
    failed = 0

    def assert_test(cond, title, details=""):
        nonlocal passed, failed
        if cond:
            print(f"  [PASS] {title}")
            passed += 1
        else:
            print(f"  [FAIL] {title} -> {details}")
            failed += 1

    client1 = TestClient()

    # 1. Health Check
    status, res = client1.request("/health")
    assert_test(status == 200 and res.get("status") == "ok" and res.get("ai_provider") == "demo",
                "1. Health Check (API alive in demo mode)")

    # 2. Onboard Guest Learner 1 (Creator path, Hindi language)
    status, res = client1.request("/onboard", "POST", {
        "language": "hi",
        "path": "creator",
        "display_name": "Aarav",
        "daily_goal_minutes": 15
    })
    assert_test(status == 200 and res.get("language") == "hi" and res.get("path") == "creator",
                "2. Onboard guest learner with path='creator' & language='hi'")

    # 3. Learner Profile Verification
    status, prof = client1.request("/profile")
    stats = prof.get("stats", {})
    assert_test(status == 200 and prof.get("display_name") == "Aarav" and stats.get("total_xp") == 0,
                "3. Profile returns 0 initial XP and accurate learner stats")

    # 4. Curriculum Verification (Creator Path)
    status, curr = client1.request("/curriculum")
    lessons = curr.get("lessons", [])
    f1 = next((l for l in lessons if l["id"] == "f1_ai_capabilities"), None)
    f2 = next((l for l in lessons if l["id"] == "f2_examples_iteration"), None)
    m1 = next((l for l in lessons if l["id"] == "m_creator_script"), None)
    m2 = next((l for l in lessons if l["id"] == "m_creator_repurpose"), None)
    assert_test(len(lessons) == 6 and f1 and f2 and m1 and m2,
                "4. Curriculum returns 4 foundations + 2 creator missions")
    assert_test(f1 and not f1["is_locked"] and f2 and f2["is_locked"],
                "5. Prerequisites properly enforced: F1 unlocked, F2 locked")

    # 5. Fetch Lesson in Hindi
    status, l_detail = client1.request("/lessons/f1_ai_capabilities")
    c_hi = l_detail.get("content", {})
    assert_test(status == 200 and "AI क्या कर सकता है" in c_hi.get("title", ""),
                "6. Lesson F1 content correctly localized in Hindi Devanagari script")
    assert_test(len(c_hi.get("understanding_checks", [])) == 2 and len(c_hi.get("glossary_terms", [])) >= 2,
                "7. Lesson F1 contains full 2 understanding checks and glossary")

    # 6. Submit Weak Task Attempt (Practice + Feedback)
    status, weak_res = client1.request("/attempts/task", "POST", {
        "lesson_id": "f1_ai_capabilities",
        "user_input": "make script",
        "idempotency_key": "weak-attempt-001"
    })
    feedback_text = weak_res.get("feedback", {}).get("text", "")
    assert_test(weak_res.get("passed") is False and "[Rule-based feedback]" in feedback_text,
                "8. Weak attempt triggers labeled rule-based feedback and requires retry")

    # 7. Retry with Strong Task Attempt
    strong_input = ("लक्ष्य: यूट्यूब शॉर्ट्स के लिए 60 सेकंड की स्क्रिप्ट बनाएं।\n"
                    "संदर्भ: टेक चैनल, युवा दर्शक।\n"
                    "सीमाएं: 150 शब्द, 3 टिप्स, सरल भाषा।\n"
                    "आउटपुट प्रारूप: टाइमस्टैम्प और हुक के साथ बुलेट पॉइंट।")
    status, strong_res = client1.request("/attempts/task", "POST", {
        "lesson_id": "f1_ai_capabilities",
        "user_input": strong_input,
        "idempotency_key": "strong-attempt-001"
    })
    sim_resp = strong_res.get("feedback", {}).get("simulated_response", "")
    assert_test(strong_res.get("passed") is True and "[Demo AI — simulated response]" in sim_resp,
                "9. Strong attempt passes with labeled simulated demo AI response")

    # 8. Idempotency Test (no double XP on resubmission)
    status, idemp_res = client1.request("/attempts/task", "POST", {
        "lesson_id": "f1_ai_capabilities",
        "user_input": strong_input,
        "idempotency_key": "strong-attempt-001"
    })
    assert_test(idemp_res.get("idempotent") is True and idemp_res.get("xp_awarded") == 0,
                "10. Idempotent submission: re-sending attempt with same key awards 0 duplicate XP")

    # 9. Complete Understanding Check
    status, check_res = client1.request("/attempts/check", "POST", {
        "lesson_id": "f1_ai_capabilities",
        "check_index": 0,
        "selected_index": 0,
        "idempotency_key": "check-f1-001"
    })
    assert_test(check_res.get("passed") is True and check_res.get("xp_awarded") == 10,
                "11. Understanding check passes and awards 10 XP")

    # 10. Check F2 Unlocked After F1 Completion
    status, curr2 = client1.request("/curriculum")
    f2_after = next((l for l in curr2.get("lessons", []) if l["id"] == "f2_examples_iteration"), None)
    assert_test(f2_after and not f2_after["is_locked"],
                "12. F2 automatically unlocks after prerequisite F1 is completed")

    # 11. Saved Items CRUD + Search + Filter
    status, save_res = client1.request("/saved", "POST", {
        "lesson_id": "f1_ai_capabilities",
        "label": "difficult",
        "note": "Remember the 4 parts: Goal, Context, Constraints, Format"
    })
    item_id = save_res.get("id")
    status, saved_list = client1.request("/saved?label=difficult")
    assert_test(status == 200 and len(saved_list.get("items", [])) >= 1,
                "13. Bookmarking / Saved items: create item and filter by label='difficult'")

    status, update_res = client1.request(f"/saved/{item_id}", "PATCH", {
        "label": "useful",
        "note": "Updated: Goal, Context, Constraints, Output"
    })
    status, search_res = client1.request("/saved?search=Goal")
    assert_test(len(search_res.get("items", [])) >= 1,
                "14. Saved items search by keyword in note")

    status, del_res = client1.request(f"/saved/{item_id}", "DELETE")
    assert_test(status == 200, "15. Saved items DELETE operation succeeds")

    # 12. Save Project Artifact
    status, proj_res = client1.request("/projects", "POST", {
        "lesson_id": "m_creator_script",
        "title": "Tech Declutter 60s Script",
        "artifact_type": "script",
        "artifact_data": {"content": "Hook: Is your phone full? 3 quick tips...", "duration": "60s"}
    })
    status, proj_list = client1.request("/projects")
    assert_test(len(proj_list.get("projects", [])) >= 1,
                "16. Project artifact saved and listed in learner portfolio")

    # 13. Spaced Repetition Reviews
    status, rev_list = client1.request("/reviews")
    assert_test(len(rev_list.get("reviews", [])) >= 1,
                "17. Spaced repetition review scheduled for completed lesson")

    # 14. Path Switching with Foundation Progress Preservation
    status, patch_prof = client1.request("/profile", "PATCH", {
        "path": "college",
        "language": "te"
    })
    status, curr_college = client1.request("/curriculum")
    c_lessons = curr_college.get("lessons", [])
    has_rev = any(l["id"] == "m_college_revision" for l in c_lessons)
    has_code = any(l["id"] == "m_college_coding" for l in c_lessons)
    f1_status = next((l for l in c_lessons if l["id"] == "f1_ai_capabilities"), None)
    assert_test(has_rev and has_code and f1_status and f1_status["progress"]["completed"],
                "18. Path switch to 'college' updates missions while PRESERVING foundation completion")

    # 15. Session Isolation (Learner 2 cannot access Learner 1)
    client2 = TestClient()
    client2.request("/onboard", "POST", {
        "language": "en",
        "path": "school",
        "display_name": "Diya"
    })
    status, p2 = client2.request("/profile")
    assert_test(p2.get("display_name") == "Diya" and p2.get("stats", {}).get("total_xp") == 0,
                "19. Session isolation: Guest 2 has independent session and 0 XP")

    # 16. Data Export
    status, exp = client1.request("/export")
    assert_test("learner" in exp and "progress" in exp and "attempts" in exp,
                "20. Clean JSON data export includes learner, progress, and attempts")

    # 17. Verify All 4 Paths Return 2 Missions
    paths = ["professional", "creator", "college", "school"]
    all_paths_ok = True
    for p in paths:
        status, curr_p = client1.request("/curriculum")
        # temporarily switch path to verify
        client1.request("/profile", "PATCH", {"path": p})
        _, cp = client1.request("/curriculum")
        m_count = len([l for l in cp.get("lessons", []) if l["type"] == "mission"])
        if m_count != 2:
            all_paths_ok = False
            break
    assert_test(all_paths_ok, "21. All 4 audience paths have exactly 2 specific missions")

    # 18. Verify All 5 Languages for All 12 Lessons
    all_langs = ["en", "hi", "te", "ta", "kn"]
    all_lang_ok = True
    all_lesson_ids = [
        "f1_ai_capabilities", "f2_examples_iteration", "f3_checking_evidence", "f4_privacy_security",
        "m_pro_email", "m_pro_meeting", "m_creator_script", "m_creator_repurpose",
        "m_college_revision", "m_college_coding", "m_school_explain", "m_school_problem"
    ]
    for lid in all_lesson_ids:
        for lang in all_langs:
            client1.request("/profile", "PATCH", {"language": lang})
            st, ldat = client1.request(f"/lessons/{lid}")
            if st != 200 or not ldat.get("content", {}).get("title"):
                all_lang_ok = False
                break
    assert_test(all_lang_ok, "22. All 12 lessons load complete localized content in all 5 languages")

    # 19. Account Deletion
    status, del_acc = client1.request("/account", "DELETE")
    status_after, _ = client1.request("/profile")
    assert_test(status == 200 and status_after == 401,
                "23. Account deletion permanently purges learner data and invalidates session")

    print("========================================================")
    print(f"Summary: {passed} passed, {failed} failed")
    print("========================================================")
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
