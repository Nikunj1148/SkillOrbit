import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import * as api from './services/api';
import type { LessonSummary, LessonDetail } from './services/api';
import CompanionRobot from './components/CompanionRobot';
import CosmicMap3D from './components/CosmicMap3D';

// ── Types ──
interface Profile {
  id: string; display_name: string; language: string; active_path: string;
  daily_goal_minutes: number; timezone: string; created_at: string;
  stats: { total_xp: number; lessons_completed: number; total_attempts: number; active_days: number; due_reviews: number; due_review_lessons: string[]; evidence_note: string; };
}

// ── Context ──
const AppContext = createContext<{
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  refreshProfile: () => Promise<void>;
}>({ profile: null, setProfile: () => {}, refreshProfile: async () => {} });

const useApp = () => useContext(AppContext);

// ── i18n basic labels ──
const UI_LABELS: Record<string, Record<string, string>> = {
  en: { feed: 'Feed', map: 'Map', practice: 'Practice', saved: 'Saved', you: 'You', loading: 'Loading...', start_lesson: 'Start Lesson', continue: 'Continue', completed: 'Completed', locked: 'Locked', submit: 'Submit', retry: 'Try Again', next: 'Next', save: 'Save', back: 'Back', xp: 'XP', demo_label: 'Demo AI — simulated response', rule_based: 'Rule-based feedback', foundation: 'Foundation', mission: 'Mission', minutes: 'min', welcome: 'Welcome to SkillOrbit!', select_language: 'Select Language', select_path: 'Choose Your Path', set_goal: 'Daily Goal', get_started: 'Get Started', no_items: 'Nothing here yet', error: 'Something went wrong', export_data: 'Export My Data', delete_account: 'Delete All Data', professional: 'Working Professionals', creator: 'Content Creators', college: 'College Beginners', school: 'School Students' },
  hi: { feed: 'फ़ीड', map: 'नक्शा', practice: 'अभ्यास', saved: 'सहेजा', you: 'आप', loading: 'लोड हो रहा है...', start_lesson: 'पाठ शुरू करें', continue: 'जारी रखें', completed: 'पूरा हुआ', locked: 'लॉक', submit: 'सबमिट करें', retry: 'फिर कोशिश करें', next: 'अगला', save: 'सहेजें', back: 'वापस', xp: 'XP', demo_label: 'डेमो AI — अनुकरणित प्रतिक्रिया', rule_based: 'नियम-आधारित फीडबैक', foundation: 'नींव', mission: 'मिशन', minutes: 'मिनट', welcome: 'SkillOrbit में आपका स्वागत है!', select_language: 'भाषा चुनें', select_path: 'अपना रास्ता चुनें', set_goal: 'दैनिक लक्ष्य', get_started: 'शुरू करें', no_items: 'अभी कुछ नहीं', error: 'कुछ गलत हो गया', export_data: 'डेटा निर्यात करें', delete_account: 'सब डेटा हटाएं', professional: 'कामकाजी पेशेवर', creator: 'कंटेंट क्रिएटर', college: 'कॉलेज शुरुआती', school: 'स्कूल छात्र' },
  te: { feed: 'ఫీడ్', map: 'మ్యాప్', practice: 'అభ్యాసం', saved: 'సేవ్', you: 'మీరు', loading: 'లోడ్ అవుతోంది...', start_lesson: 'పాఠం ప్రారంభించండి', continue: 'కొనసాగించండి', completed: 'పూర్తయింది', locked: 'లాక్', submit: 'సమర్పించండి', retry: 'మళ్ళీ ప్రయత్నించండి', next: 'తదుపరి', save: 'సేవ్ చేయండి', back: 'వెనుకకు', xp: 'XP', demo_label: 'డెమో AI — అనుకరణ ప్రతిస్పందన', rule_based: 'నియమ-ఆధారిత ఫీడ్‌బ్యాక్', foundation: 'పునాది', mission: 'మిషన్', minutes: 'నిమి', welcome: 'SkillOrbit కి స్వాగతం!', select_language: 'భాష ఎంచుకోండి', select_path: 'మీ మార్గం ఎంచుకోండి', set_goal: 'రోజువారీ లక్ష్యం', get_started: 'ప్రారంభించండి', no_items: 'ఇంకా ఏమీ లేదు', error: 'ఏదో తప్పు జరిగింది', export_data: 'డేటా ఎగుమతి', delete_account: 'మొత్తం డేటా తొలగించండి', professional: 'వృత్తి నిపుణులు', creator: 'కంటెంట్ క్రియేటర్లు', college: 'కాలేజీ ప్రారంభకులు', school: 'పాఠశాల విద్యార్థులు' },
  ta: { feed: 'ஃபீட்', map: 'வரைபடம்', practice: 'பயிற்சி', saved: 'சேமித்தவை', you: 'நீங்கள்', loading: 'ஏற்றுகிறது...', start_lesson: 'பாடம் தொடங்கு', continue: 'தொடரவும்', completed: 'முடிந்தது', locked: 'பூட்டியது', submit: 'சமர்ப்பி', retry: 'மீண்டும் முயற்சி', next: 'அடுத்து', save: 'சேமி', back: 'பின்னால்', xp: 'XP', demo_label: 'டெமோ AI — உருவகப்படுத்தப்பட்ட பதில்', rule_based: 'விதி அடிப்படை கருத்து', foundation: 'அடிப்படை', mission: 'பணி', minutes: 'நிமி', welcome: 'SkillOrbit-க்கு வரவேற்பு!', select_language: 'மொழி தேர்வு', select_path: 'பாதை தேர்வு', set_goal: 'தினசரி இலக்கு', get_started: 'தொடங்குங்கள்', no_items: 'இன்னும் ஒன்றுமில்லை', error: 'ஏதோ தவறு', export_data: 'தரவு ஏற்றுமதி', delete_account: 'எல்லா தரவையும் நீக்கு', professional: 'தொழில் வல்லுநர்கள்', creator: 'உள்ளடக்க படைப்பாளிகள்', college: 'கல்லூரி தொடக்கநிலை', school: 'பள்ளி மாணவர்கள்' },
  kn: { feed: 'ಫೀಡ್', map: 'ನಕ್ಷೆ', practice: 'ಅಭ್ಯಾಸ', saved: 'ಉಳಿಸಿದವು', you: 'ನೀವು', loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...', start_lesson: 'ಪಾಠ ಪ್ರಾರಂಭಿಸಿ', continue: 'ಮುಂದುವರಿಸಿ', completed: 'ಪೂರ್ಣ', locked: 'ಲಾಕ್', submit: 'ಸಲ್ಲಿಸಿ', retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', next: 'ಮುಂದೆ', save: 'ಉಳಿಸಿ', back: 'ಹಿಂದೆ', xp: 'XP', demo_label: 'ಡೆಮೋ AI — ಅನುಕರಣೆ ಪ್ರತಿಕ್ರಿಯೆ', rule_based: 'ನಿಯಮ-ಆಧಾರಿತ ಪ್ರತಿಕ್ರಿಯೆ', foundation: 'ಅಡಿಪಾಯ', mission: 'ಮಿಷನ್', minutes: 'ನಿಮಿ', welcome: 'SkillOrbit ಗೆ ಸ್ವಾಗತ!', select_language: 'ಭಾಷೆ ಆಯ್ಕೆ', select_path: 'ಮಾರ್ಗ ಆಯ್ಕೆ', set_goal: 'ದೈನಂದಿನ ಗುರಿ', get_started: 'ಪ್ರಾರಂಭಿಸಿ', no_items: 'ಇನ್ನೂ ಏನೂ ಇಲ್ಲ', error: 'ಏನೋ ತಪ್ಪಾಯಿತು', export_data: 'ಡೇಟಾ ರಫ್ತು', delete_account: 'ಎಲ್ಲ ಡೇಟಾ ಅಳಿಸಿ', professional: 'ಕೆಲಸದ ವೃತ್ತಿಪರರು', creator: 'ಕಂಟೆಂಟ್ ಕ್ರಿಯೇಟರ್ಸ್', college: 'ಕಾಲೇಜು ಆರಂಭಿಕರು', school: 'ಶಾಲಾ ವಿದ್ಯಾರ್ಥಿಗಳು' }
};

function t(key: string, lang: string): string {
  return UI_LABELS[lang]?.[key] || UI_LABELS['en']?.[key] || key;
}

const LANG_FLAGS: Record<string,string> = { en:'🌐', hi:'🇮🇳', te:'🇮🇳', ta:'🇮🇳', kn:'🇮🇳' };
const LANG_NAMES: Record<string,string> = { en:'English', hi:'हिन्दी', te:'తెలుగు', ta:'தமிழ்', kn:'ಕನ್ನಡ' };
const PATH_ICONS: Record<string,string> = { professional:'💼', creator:'🎬', college:'🎓', school:'📚' };

// ── Onboarding Page ──
function OnboardingPage() {
  const { setProfile } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState('en');
  const [path, setPath] = useState('professional');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await api.onboard({ language: lang, path, display_name: name || undefined, daily_goal_minutes: goal });
      const prof = await api.getProfile();
      setProfile(prof as unknown as Profile);
      navigate('/feed');
    } catch (e: any) { setError(e.message || 'Failed to start'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', padding: 32 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🚀</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SkillOrbit</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>{t('welcome', lang)}</p>
        </div>

        {/* Step 0: Language */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>{t('select_language', lang)}</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(LANG_NAMES).map(([code, label]) => (
                <button key={code} className={`btn ${lang === code ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setLang(code)} style={{ justifyContent: 'flex-start' }}>
                  {LANG_FLAGS[code]} {label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setStep(1)}>
              {t('next', lang)} →
            </button>
          </div>
        )}

        {/* Step 1: Path */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>{t('select_path', lang)}</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {(['professional', 'creator', 'college', 'school'] as const).map(p => (
                <button key={p} className={`btn ${path === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPath(p)} style={{ justifyContent: 'flex-start' }}>
                  {PATH_ICONS[p]} {t(p, lang)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← {t('back', lang)}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>
                {t('next', lang)} →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Name & Goal */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Display Name (optional)</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Priya" maxLength={50} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('set_goal', lang)}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[5, 10, 15].map(g => (
                  <button key={g} className={`btn ${goal === g ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setGoal(g)} style={{ flex: 1 }}>
                    {g} {t('minutes', lang)}
                  </button>
                ))}
              </div>
            </div>
            {error && <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.9rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← {t('back', lang)}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading}>
                {loading ? '...' : t('get_started', lang)} 🚀
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
              Guest access — no signup needed. Note: no account recovery or cross-device access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Feed Page ──
function FeedPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [curriculum, setCurriculum] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const lang = profile?.language || 'en';

  useEffect(() => {
    api.getCurriculum().then(r => { setCurriculum(r.lessons); setLoading(false); }).catch(() => setLoading(false));
  }, [profile?.active_path, profile?.language]);

  if (loading) return <div className="container" style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  const inProgress = curriculum.filter(l => !l.is_locked && l.progress.attempt_count > 0 && !l.progress.completed);
  const available = curriculum.filter(l => !l.is_locked && l.progress.attempt_count === 0);
  const completed = curriculum.filter(l => l.progress.completed);

  return (
    <div className="container main-content" style={{ paddingTop: 24, paddingBottom: 100 }}>
      {/* Header with 3D Companion */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="chip" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
              {PATH_ICONS[profile?.active_path||'professional']} {t(profile?.active_path||'professional', lang)}
            </span>
            <div className="xp-badge">⭐ {profile?.stats?.total_xp || 0} {t('xp', lang)}</div>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
            {profile?.display_name ? `Hi, ${profile.display_name}!` : t('welcome', lang).replace('!','')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
            Master practical AI workflows step by step.
          </p>
        </div>
        <CompanionRobot
          mood={profile?.stats && profile.stats.lessons_completed > 0 ? 'happy' : 'idle'}
          size={95}
          speechText={profile?.stats?.lessons_completed === 0 ? "Click any available lesson to start your journey! 🚀" : undefined}
        />
      </div>

      {/* Stats bar */}
      <div className="glass-sm" style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 16px', marginBottom: 24, borderRadius: 'var(--border-radius-lg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{profile?.stats?.lessons_completed || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('completed', lang)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{profile?.stats?.active_days || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-tertiary)' }}>{profile?.stats?.due_reviews || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reviews</div>
        </div>
      </div>

      {/* Continue Learning */}
      {inProgress.length > 0 && (
        <Section title="🔥 Continue Learning">
          {inProgress.map(l => <LessonCard key={l.id} lesson={l} lang={lang} onClick={() => navigate(`/lesson/${l.id}`)} />)}
        </Section>
      )}

      {/* Available */}
      {available.length > 0 && (
        <Section title="📚 Available Lessons">
          {available.map(l => <LessonCard key={l.id} lesson={l} lang={lang} onClick={() => navigate(`/lesson/${l.id}`)} />)}
        </Section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <Section title={`✅ ${t('completed', lang)}`}>
          {completed.map(l => <LessonCard key={l.id} lesson={l} lang={lang} onClick={() => navigate(`/lesson/${l.id}`)} />)}
        </Section>
      )}

      {/* Locked */}
      {curriculum.filter(l => l.is_locked).length > 0 && (
        <Section title={`🔒 ${t('locked', lang)}`}>
          {curriculum.filter(l => l.is_locked).map(l => <LessonCard key={l.id} lesson={l} lang={lang} onClick={() => {}} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>{title}</h2>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </div>
  );
}

function LessonCard({ lesson, lang, onClick }: { lesson: LessonSummary; lang: string; onClick: () => void }) {
  const isLocked = lesson.is_locked;
  const isDone = lesson.progress.completed;
  return (
    <div className={`card ${isLocked ? '' : 'card-interactive'}`} onClick={isLocked ? undefined : onClick}
      style={{ opacity: isLocked ? 0.5 : 1, cursor: isLocked ? 'default' : 'pointer',
        borderLeft: isDone ? '3px solid var(--success)' : lesson.progress.attempt_count > 0 ? '3px solid var(--accent-primary)' : '3px solid transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span className="chip" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              {lesson.type === 'foundation' ? t('foundation', lang) : t('mission', lang)}
            </span>
            {isDone && <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>✓</span>}
            {isLocked && <span>🔒</span>}
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{lesson.title}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{lesson.description?.slice(0, 100)}{lesson.description?.length > 100 ? '...' : ''}</p>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 12 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>~{lesson.estimated_duration_minutes} {t('minutes', lang)}</div>
          {lesson.progress.total_xp > 0 && <div className="xp-badge" style={{ marginTop: 4 }}>+{lesson.progress.total_xp}</div>}
        </div>
      </div>
      {lesson.progress.attempt_count > 0 && !isDone && (
        <div className="progress-bar" style={{ marginTop: 8 }}>
          <div className="progress-fill" style={{ width: lesson.progress.task_passed ? '80%' : '30%' }} />
        </div>
      )}
    </div>
  );
}

// ── Lesson Page ──
function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, refreshProfile } = useApp();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [phase, setPhase] = useState<'explanation' | 'example' | 'task' | 'check0' | 'check1' | 'feedback' | 'recap'>('explanation');
  const [taskInput, setTaskInput] = useState('');
  const [taskResult, setTaskResult] = useState<any>(null);
  const [checkResults, setCheckResults] = useState<Record<number, any>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const lang = profile?.language || 'en';

  useEffect(() => {
    if (id) {
      api.getLesson(id).then(l => {
        setLesson(l);
        // Restore draft from localStorage
        const draft = localStorage.getItem(`draft_${id}`);
        if (draft) setTaskInput(draft);
      }).catch(() => setError('Could not load lesson'));
    }
  }, [id]);

  // Auto-save draft
  useEffect(() => {
    if (id && taskInput) localStorage.setItem(`draft_${id}`, taskInput);
  }, [taskInput, id]);

  if (error) return <div className="container main-content" style={{ padding: 40, textAlign: 'center' }}><p style={{ color: 'var(--error)' }}>⚠ {error}</p><button className="btn btn-secondary" onClick={() => navigate('/feed')}>{t('back', lang)}</button></div>;
  if (!lesson) return <div className="container main-content" style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  const content = lesson.content;

  const handleTaskSubmit = async () => {
    if (!taskInput.trim()) return;
    setSubmitting(true);
    try {
      const result = await api.submitTaskAttempt({
        lesson_id: lesson.id, user_input: taskInput,
        idempotency_key: api.generateIdempotencyKey()
      });
      setTaskResult(result);
      setPhase('feedback');
      localStorage.removeItem(`draft_${lesson.id}`);
      await refreshProfile();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleCheckSubmit = async (checkIndex: number) => {
    if (selectedOption === null) return;
    setSubmitting(true);
    try {
      const result = await api.submitCheckAttempt({
        lesson_id: lesson.id, check_index: checkIndex, selected_index: selectedOption,
        idempotency_key: api.generateIdempotencyKey()
      });
      setCheckResults({ ...checkResults, [checkIndex]: result });
      setSelectedOption(null);
      await refreshProfile();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleSave = async () => {
    try {
      await api.saveItem({ lesson_id: lesson.id, label: 'useful' });
      setSaved(true);
    } catch {}
  };

  const handleSaveProject = async () => {
    if (!taskInput.trim()) return;
    try {
      await api.saveProject({
        lesson_id: lesson.id,
        title: content.title,
        artifact_type: content.interactive_task.artifact_type || 'text',
        artifact_data: { content: taskInput, simulated_response: taskResult?.feedback?.simulated_response }
      });
      alert('Project saved! Check Your Profile → Projects.');
    } catch {}
  };

  return (
    <div className="container main-content" style={{ paddingTop: 16, paddingBottom: 100, maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/feed')}>← {t('back', lang)}</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleSave} disabled={saved}>{saved ? '✓ Saved' : '🔖 ' + t('save', lang)}</button>
        </div>
      </div>

      {/* Title with Companion */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span className="chip" style={{ marginBottom: 8 }}>{lesson.type === 'foundation' ? t('foundation', lang) : t('mission', lang)} · ~{lesson.estimated_duration_minutes}{t('minutes', lang)}</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 8 }}>{content.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>🎯 {content.outcome}</p>
          {!lesson.translation_status.reviewed && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>⚠ Translation not reviewed by a native speaker</p>}
        </div>
        <CompanionRobot
          size={78}
          mood={phase === 'task' ? 'thinking' : (taskResult?.passed || checkResults[0]?.passed || checkResults[1]?.passed) ? 'celebrating' : 'idle'}
        />
      </div>

      {/* Phase navigation dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
        {(['explanation','example','task','check0','check1','feedback','recap'] as const).map(p => (
          <div key={p} style={{ width: 8, height: 8, borderRadius: '50%', background: phase === p ? 'var(--accent-primary)' : 'var(--bg-glass)', cursor: 'pointer' }}
            onClick={() => setPhase(p)} />
        ))}
      </div>

      {/* Explanation */}
      {phase === 'explanation' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.95rem' }}>{content.explanation}</div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setPhase('example')}>
            {t('next', lang)}: Worked Example →
          </button>
        </div>
      )}

      {/* Worked Example */}
      {phase === 'example' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>📖 Scenario</h3>
            <p>{content.worked_example.scenario}</p>
          </div>
          <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--error)' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--error)', marginBottom: 4 }}>❌ Weak Attempt</h3>
            <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{content.worked_example.bad_attempt}</p>
          </div>
          <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--success)' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: 4 }}>✅ Strong Attempt</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', fontFamily: 'var(--font-primary)' }}>{content.worked_example.good_attempt}</pre>
          </div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>💡 Why Better?</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{content.worked_example.why_better}</p>
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setPhase('task')}>
            {t('next', lang)}: Your Turn! →
          </button>
        </div>
      )}

      {/* Interactive Task */}
      {phase === 'task' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>✏️ Your Task</h3>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{content.interactive_task.instruction}</div>

            <textarea className="input" value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              placeholder={content.interactive_task.starter_text}
              style={{ minHeight: 160 }} maxLength={5000} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowHints(!showHints)}>
                {showHints ? '🙈 Hide Hints' : '💡 Show Hints'}
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{taskInput.length}/5000</span>
            </div>

            {showHints && (
              <div className="glass-sm" style={{ padding: 12, marginTop: 8, borderRadius: 'var(--border-radius-md)' }}>
                {content.interactive_task.hints.map((h, i) => (
                  <p key={i} style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', marginBottom: 4 }}>💡 {h}</p>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleTaskSubmit} disabled={submitting || !taskInput.trim()}>
            {submitting ? '...' : t('submit', lang)} 🚀
          </button>
        </div>
      )}

      {/* Feedback */}
      {phase === 'feedback' && taskResult && (
        <div>
          <div className="card" style={{ marginBottom: 16, borderLeft: taskResult.passed ? '3px solid var(--success)' : '3px solid var(--warning)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '1.5rem' }}>{taskResult.passed ? '🎉' : '💪'}</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{taskResult.passed ? 'Great Work!' : 'Keep Trying!'}</h3>
              {taskResult.xp_awarded > 0 && <span className="xp-badge">+{taskResult.xp_awarded} XP</span>}
            </div>
            <div className="demo-label" style={{ marginBottom: 8 }}>{t('demo_label', lang)}</div>
            <div className="demo-label" style={{ marginBottom: 12 }}>{t('rule_based', lang)}</div>

            {/* Simulated response */}
            {taskResult.feedback?.simulated_response && (
              <div className="glass-sm" style={{ padding: 12, marginBottom: 12, borderRadius: 'var(--border-radius-md)' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', fontFamily: 'var(--font-primary)' }}>{taskResult.feedback.simulated_response}</pre>
              </div>
            )}

            {/* Feedback text */}
            <p style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{taskResult.feedback?.text}</p>

            {/* Criteria results */}
            {taskResult.criteria_results && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>📊 Criteria Checked:</h4>
                {taskResult.criteria_results.map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: '0.85rem' }}>
                    <span>{c.met ? '✅' : '❌'}</span>
                    <span>{c.criterion}: {c.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!taskResult.passed && <button className="btn btn-secondary" onClick={() => { setTaskResult(null); setPhase('task'); }}>{t('retry', lang)} 🔄</button>}
            {content.interactive_task.produces_artifact && <button className="btn btn-secondary" onClick={handleSaveProject}>💾 Save Project</button>}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setPhase('check0')}>
              {t('next', lang)}: Understanding Checks →
            </button>
          </div>
        </div>
      )}

      {/* Understanding Checks */}
      {(phase === 'check0' || phase === 'check1') && (
        <div>
          {(() => {
            const checkIndex = phase === 'check0' ? 0 : 1;
            const check = content.understanding_checks[checkIndex];
            const result = checkResults[checkIndex];
            if (!check) { setPhase('recap'); return null; }
            return (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>🧠 Check {checkIndex + 1}/2</h3>
                <p style={{ marginBottom: 12 }}>{check.question}</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {check.options.map((opt, i) => (
                    <button key={i}
                      className={`btn ${result ? (i === check.correct_index ? 'btn-success' : (result.feedback && !result.passed && selectedOption === i ? 'btn-ghost' : 'btn-secondary')) : (selectedOption === i ? 'btn-primary' : 'btn-secondary')}`}
                      onClick={() => !result && setSelectedOption(i)}
                      disabled={!!result}
                      style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                      {result && i === check.correct_index ? '✅ ' : ''}{opt}
                    </button>
                  ))}
                </div>
                {result && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-glass)', borderRadius: 'var(--border-radius-md)' }}>
                    <p>{result.feedback?.text}</p>
                    {result.xp_awarded > 0 && <span className="xp-badge" style={{ marginTop: 8 }}>+{result.xp_awarded} XP</span>}
                  </div>
                )}
                {!result ? (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => handleCheckSubmit(checkIndex)} disabled={selectedOption === null || submitting}>
                    {submitting ? '...' : t('submit', lang)}
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}
                    onClick={() => setPhase(phase === 'check0' ? 'check1' : 'recap')}>
                    {t('next', lang)} →
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Recap */}
      {phase === 'recap' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>🎓 Recap</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{content.recap}</p>

            {content.glossary_terms.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>📖 Glossary</h4>
                {content.glossary_terms.map((g, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <strong style={{ color: 'var(--accent-primary)' }}>{g.term}</strong>: <span style={{ color: 'var(--text-secondary)' }}>{g.definition}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleSave} disabled={saved}>
              {saved ? '✓ Saved' : '🔖 ' + t('save', lang)}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/feed')}>
              ✨ Back to Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Map Page ──
function MapPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [curriculum, setCurriculum] = useState<LessonSummary[]>([]);
  const lang = profile?.language || 'en';

  useEffect(() => {
    api.getCurriculum().then(r => setCurriculum(r.lessons)).catch(() => {});
  }, []);

  return (
    <div className="container main-content" style={{ paddingTop: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🗺️ {t('map', lang)} — Cosmic Solar Map</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
            Interactive celestial orbit for {t(profile?.active_path || 'professional', lang)}
          </p>
        </div>
      </div>

      <CosmicMap3D
        curriculum={curriculum}
        onSelectLesson={(lessonId) => navigate(`/lesson/${lessonId}`)}
        activePath={profile?.active_path || 'professional'}
        language={lang}
      />
    </div>
  );
}

// ── Saved Page ──
function SavedPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const lang = profile?.language || 'en';

  const load = useCallback(() => {
    api.getSavedItems(filter || undefined, search || undefined).then(r => setItems(r.items)).catch(() => {});
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => { await api.deleteSavedItem(id); load(); };
  const handleUpdateLabel = async (id: string, label: string) => { await api.updateSavedItem(id, { label }); load(); };

  return (
    <div className="container main-content" style={{ paddingTop: 24, paddingBottom: 100 }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>🔖 {t('saved', lang)}</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'useful', 'difficult', 'review_later'].map(f => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === '' ? 'All' : f === 'useful' ? '⭐ Useful' : f === 'difficult' ? '🔥 Difficult' : '📅 Review Later'}
          </button>
        ))}
      </div>

      <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved items..." style={{ marginBottom: 16 }} />

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔖</div>
          <p>{t('no_items', lang)}</p>
          <p style={{ fontSize: '0.85rem' }}>Save lessons and examples as you learn!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="chip" style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                    {item.label === 'useful' ? '⭐' : item.label === 'difficult' ? '🔥' : '📅'} {item.label}
                  </span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => navigate(`/lesson/${item.lesson_id}`)}>{item.lesson_id}</h3>
                  {item.note && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>{item.note}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: 'var(--border-glass)', borderRadius: 8, padding: '4px 8px', fontSize: '0.8rem' }}
                    value={item.label} onChange={e => handleUpdateLabel(item.id, e.target.value)}>
                    <option value="useful">⭐ Useful</option>
                    <option value="difficult">🔥 Difficult</option>
                    <option value="review_later">📅 Review</option>
                  </select>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', minHeight: 'auto' }} onClick={() => handleDelete(item.id)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Profile Page ──
function ProfilePage() {
  const { profile, refreshProfile, setProfile } = useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const lang = profile?.language || 'en';

  useEffect(() => {
    api.getProjects().then(r => setProjects(r.projects)).catch(() => {});
    api.getReviews().then(r => setReviews(r.reviews)).catch(() => {});
  }, []);

  const handlePathChange = async (path: string) => {
    await api.updateProfile({ path });
    await refreshProfile();
  };

  const handleLangChange = async (language: string) => {
    await api.updateProfile({ language });
    await refreshProfile();
  };

  const handleExport = async () => {
    const data = await api.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'skillorbit-export.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirm('This will permanently delete all your data. Are you sure?')) return;
    await api.deleteAccount();
    setProfile(null);
    navigate('/');
  };

  if (!profile) return null;

  return (
    <div className="container main-content" style={{ paddingTop: 24, paddingBottom: 100 }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>👤 {profile.display_name || 'Guest Learner'}</h1>

      {/* Stats */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>📊 Growth</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div><span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{profile.stats.total_xp}</span><br /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total XP</span></div>
          <div><span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--success)' }}>{profile.stats.lessons_completed}</span><br /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed</span></div>
          <div><span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{profile.stats.total_attempts}</span><br /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Attempts</span></div>
          <div><span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>{profile.stats.active_days}</span><br /><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Days</span></div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>{profile.stats.evidence_note}</p>
      </div>

      {/* Path switch */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>🛤️ Learning Path</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {(['professional', 'creator', 'college', 'school'] as const).map(p => (
            <button key={p} className={`btn ${profile.active_path === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handlePathChange(p)} style={{ fontSize: '0.85rem' }}>
              {PATH_ICONS[p]} {t(p, lang)}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Changing paths preserves your foundation progress. Path-specific mission progress stays separate.</p>
      </div>

      {/* Language switch */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>🌐 Language</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(LANG_NAMES).map(([code, name]) => (
            <button key={code} className={`chip ${profile.language === code ? 'active' : ''}`}
              onClick={() => handleLangChange(code)}>{name}</button>
          ))}
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>📅 Review Schedule</h2>
          {reviews.map(r => (
            <div key={r.lesson_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: 'var(--border-glass)' }}>
              <span style={{ fontSize: '0.9rem' }}>{r.lesson_id}</span>
              <span style={{ fontSize: '0.8rem', color: r.is_due ? 'var(--accent-warm)' : 'var(--text-muted)' }}>
                {r.is_due ? '⏰ Due now!' : `Next: ${new Date(r.next_review).toLocaleDateString()}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>📁 Saved Projects</h2>
          {projects.map(p => (
            <div key={p.id} className="glass-sm" style={{ padding: 10, marginBottom: 8, borderRadius: 8 }}>
              <strong>{p.title}</strong> <span className="chip" style={{ fontSize: '0.7rem' }}>{p.artifact_type}</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{new Date(p.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Data management */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={handleExport}>📥 {t('export_data', lang)}</button>
        <button className="btn btn-ghost" onClick={handleDelete} style={{ color: 'var(--error)' }}>🗑 {t('delete_account', lang)}</button>
      </div>
    </div>
  );
}

// ── Bottom Nav ──
function BottomNav() {
  const { profile } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const lang = profile?.language || 'en';
  const tabs = [
    { path: '/feed', icon: '🏠', label: t('feed', lang) },
    { path: '/map', icon: '🗺️', label: t('map', lang) },
    { path: '/saved', icon: '🔖', label: t('saved', lang) },
    { path: '/profile', icon: '👤', label: t('you', lang) },
  ];

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 'var(--mobile-nav-height)',
      background: 'rgba(10, 14, 39, 0.95)', backdropFilter: 'blur(12px)', borderTop: 'var(--border-glass)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100, padding: '0 8px' }}
      role="navigation" aria-label="Main navigation">
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.path);
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)}
            className="btn btn-ghost" style={{ flexDirection: 'column', gap: 2, padding: '8px 16px', minWidth: 64,
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.7rem' }}
            aria-current={isActive ? 'page' : undefined}>
            <span style={{ fontSize: '1.3rem' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── App ──
function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshProfile = async () => {
    try {
      const p = await api.getProfile();
      setProfile(p as unknown as Profile);
    } catch { /* Not logged in */ }
  };

  useEffect(() => {
    refreshProfile().finally(() => setChecking(false));
  }, []);

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading SkillOrbit...</p>
      </div>
    </div>
  );

  return (
    <AppContext.Provider value={{ profile, setProfile, refreshProfile }}>
      <BrowserRouter>
        {profile ? (
          <>
            <Routes>
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/lesson/:id" element={<LessonPage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/feed" />} />
            </Routes>
            <BottomNav />
          </>
        ) : (
          <Routes>
            <Route path="*" element={<OnboardingPage />} />
          </Routes>
        )}
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
