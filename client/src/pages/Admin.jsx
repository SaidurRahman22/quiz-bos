import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminGetTopics,
  adminListQuestions,
  adminCreateQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import './Admin.css';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

// Pull a human-readable message out of an axios error, falling back gracefully.
function errMessage(err, fallback = 'Something went wrong.') {
  return err?.response?.data?.error || err?.message || fallback;
}

/* ------------------------------------------------------------------ *
 * Extension point: add new admin tools by appending to SECTIONS.
 * Each entry = { id, label, icon, Component }. The Component receives
 * no required props and owns its own data-loading. Add a section here
 * and it automatically shows up as a tab — nothing else to wire up.
 * ------------------------------------------------------------------ */
const SECTIONS = [{ id: 'questions', label: 'Questions', icon: '📝', Component: QuestionsManager }];

export default function Admin() {
  const { user, ready } = useAuth();
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  if (!ready) return <Loader label="Loading…" />;

  // Friendly 403 rather than a hard redirect. The server enforces admin too.
  if (!user || !user.isAdmin) {
    return (
      <div className="container-narrow fade-in">
        <div className="qb-card p-5 text-center mt-4">
          <div style={{ fontSize: '3rem' }}>🔒</div>
          <h3 className="mt-2">Not authorized</h3>
          <p className="text-muted-2 mb-4">
            This area is for administrators only. If you think this is a mistake, contact the site
            owner.
          </p>
          <Link to="/" className="btn btn-gradient">
            ← Back home
          </Link>
        </div>
      </div>
    );
  }

  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];
  const ActiveComponent = active.Component;

  return (
    <div className="container fade-in">
      <div className="adm-head">
        <h1 className="mb-0">
          🛠️ <span className="gradient-text">Admin</span>
        </h1>
        <p className="text-muted-2 mb-0">Manage quiz content and site data.</p>
      </div>

      {/* Tab bar — grows automatically with SECTIONS */}
      <div className="adm-tabs" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === activeId}
            className={`adm-tab${s.id === activeId ? ' active' : ''}`}
            onClick={() => setActiveId(s.id)}
          >
            <span aria-hidden="true">{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      <div className="adm-panel">
        <ActiveComponent />
      </div>
    </div>
  );
}

/* ================================================================== *
 * Questions manager — the one working section today.
 * ================================================================== */
function QuestionsManager() {
  const [topics, setTopics] = useState(null);
  const [topicsError, setTopicsError] = useState('');
  const [activeSlug, setActiveSlug] = useState('');

  const [questions, setQuestions] = useState(null);
  const [listError, setListError] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  const [editing, setEditing] = useState(null); // null = none, {} = new, {...} = editing existing
  const [toast, setToast] = useState(null); // { type: 'success' | 'danger', text }

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // Load topics once.
  useEffect(() => {
    let alive = true;
    adminGetTopics()
      .then((list) => {
        if (!alive) return;
        setTopics(list);
        if (list.length) setActiveSlug((cur) => cur || list[0].slug);
      })
      .catch((err) => alive && setTopicsError(errMessage(err, 'Could not load topics.')));
    return () => {
      alive = false;
    };
  }, []);

  const loadQuestions = useCallback((slug) => {
    if (!slug) return;
    setLoadingList(true);
    setListError('');
    return adminListQuestions(slug)
      .then((list) => setQuestions(list))
      .catch((err) => {
        setQuestions([]);
        setListError(errMessage(err, 'Could not load questions.'));
      })
      .finally(() => setLoadingList(false));
  }, []);

  // (Re)load questions whenever the selected topic changes.
  useEffect(() => {
    if (activeSlug) {
      setEditing(null);
      loadQuestions(activeSlug);
    }
  }, [activeSlug, loadQuestions]);

  const activeTopic = useMemo(
    () => topics?.find((t) => t.slug === activeSlug) || null,
    [topics, activeSlug]
  );

  // Refresh topic counts after a create/delete so the pills stay accurate.
  const refreshTopics = useCallback(() => {
    adminGetTopics()
      .then(setTopics)
      .catch(() => {
        /* non-fatal: counts can be slightly stale */
      });
  }, []);

  async function handleSave(payload) {
    // Returns a rejected promise on failure so the form can surface it inline.
    if (editing && editing.id) {
      const updated = await adminUpdateQuestion(editing.id, payload);
      setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
      showToast('success', 'Question updated.');
    } else {
      const created = await adminCreateQuestion({ topicSlug: activeSlug, ...payload });
      setQuestions((qs) => [created, ...(qs || [])]);
      refreshTopics();
      showToast('success', 'Question added.');
    }
    setEditing(null);
  }

  async function handleDelete(q) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    try {
      await adminDeleteQuestion(q.id);
      setQuestions((qs) => qs.filter((x) => x.id !== q.id));
      if (editing && editing.id === q.id) setEditing(null);
      refreshTopics();
      showToast('success', 'Question deleted.');
    } catch (err) {
      showToast('danger', errMessage(err, 'Could not delete question.'));
    }
  }

  if (topicsError) return <div className="alert alert-danger">{topicsError}</div>;
  if (!topics) return <Loader label="Loading topics…" />;
  if (!topics.length)
    return <div className="alert alert-warning">No topics found. Seed some topics first.</div>;

  return (
    <div>
      {toast && <div className={`adm-toast adm-toast-${toast.type}`}>{toast.text}</div>}

      {/* Topic picker */}
      <div className="adm-topics" role="tablist" aria-label="Topics">
        {topics.map((t) => (
          <button
            key={t.id}
            className={`adm-topic-pill${t.slug === activeSlug ? ' active' : ''}`}
            style={t.color ? { '--pill-accent': t.color } : undefined}
            onClick={() => setActiveSlug(t.slug)}
            aria-selected={t.slug === activeSlug}
          >
            {t.icon && <span aria-hidden="true">{t.icon}</span>} {t.name}
            <span className="adm-count">{t.questionCount}</span>
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <div className="adm-toolbar-title">
          {activeTopic ? activeTopic.name : 'Questions'}
          {questions && <span className="text-muted-2"> · {questions.length} shown</span>}
        </div>
        {!editing && (
          <button className="btn btn-gradient" onClick={() => setEditing({})}>
            + Add question
          </button>
        )}
      </div>

      {/* Add / edit form */}
      {editing && (
        <QuestionForm
          key={editing.id || 'new'}
          initial={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* List */}
      {listError && <div className="alert alert-danger">{listError}</div>}
      {loadingList && !questions ? (
        <Loader label="Loading questions…" />
      ) : questions && questions.length === 0 ? (
        <div className="adm-empty">No questions in this topic yet. Add the first one above.</div>
      ) : (
        <ul className="adm-qlist">
          {questions?.map((q, i) => (
            <li key={q.id} className="adm-qcard">
              <div className="adm-qcard-top">
                <span className="adm-qnum">{i + 1}</span>
                <p className="adm-qtext">{q.question}</p>
                <span className={`difficulty-tag diff-${q.difficulty}`}>{q.difficulty}</span>
              </div>
              <ul className="adm-opts">
                {q.options.map((opt, oi) => (
                  <li
                    key={oi}
                    className={`adm-opt${oi === q.correctIndex ? ' correct' : ''}`}
                  >
                    <span className="adm-opt-key">{String.fromCharCode(65 + oi)}</span>
                    <span>{opt}</span>
                    {oi === q.correctIndex && <span className="adm-opt-check">✓</span>}
                  </li>
                ))}
              </ul>
              {q.explanation && <div className="adm-expl">{q.explanation}</div>}
              <div className="adm-qcard-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(q)}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm adm-danger" onClick={() => handleDelete(q)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================================================================== *
 * Reusable form for both create and edit.
 * ================================================================== */
function emptyForm() {
  return { question: '', options: ['', ''], correctIndex: 0, difficulty: 'medium', explanation: '' };
}

function QuestionForm({ initial, onSave, onCancel }) {
  const isEdit = Boolean(initial && initial.id);
  const [form, setForm] = useState(() => {
    if (!initial || !initial.id) return emptyForm();
    return {
      question: initial.question || '',
      options: initial.options?.length ? [...initial.options] : ['', ''],
      correctIndex: initial.correctIndex ?? 0,
      difficulty: initial.difficulty || 'medium',
      explanation: initial.explanation || '',
    };
  });
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const setOption = (idx, value) =>
    setForm((f) => ({ ...f, options: f.options.map((o, i) => (i === idx ? value : o)) }));

  const addOption = () =>
    setForm((f) =>
      f.options.length >= MAX_OPTIONS ? f : { ...f, options: [...f.options, ''] }
    );

  const removeOption = (idx) =>
    setForm((f) => {
      if (f.options.length <= MIN_OPTIONS) return f;
      const options = f.options.filter((_, i) => i !== idx);
      // Keep correctIndex pointing at the same answer (or clamp).
      let correctIndex = f.correctIndex;
      if (idx === correctIndex) correctIndex = 0;
      else if (idx < correctIndex) correctIndex -= 1;
      return { ...f, options, correctIndex };
    });

  function validate() {
    if (!form.question.trim()) return 'Question text is required.';
    const trimmed = form.options.map((o) => o.trim());
    if (trimmed.length < MIN_OPTIONS) return `At least ${MIN_OPTIONS} options are required.`;
    if (trimmed.some((o) => !o)) return 'All options must be filled in (or removed).';
    if (form.correctIndex < 0 || form.correctIndex >= trimmed.length)
      return 'Please choose the correct answer.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    const problem = validate();
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError('');
    setSaving(true);
    try {
      await onSave({
        question: form.question.trim(),
        options: form.options.map((o) => o.trim()),
        correctIndex: form.correctIndex,
        difficulty: form.difficulty,
        explanation: form.explanation.trim(),
      });
      // Parent unmounts/clears this form on success.
    } catch (err) {
      setServerError(errMessage(err, 'Could not save the question.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="adm-form qb-card" onSubmit={handleSubmit}>
      <div className="adm-form-title">{isEdit ? 'Edit question' : 'New question'}</div>

      <label className="adm-label" htmlFor="adm-q">
        Question
      </label>
      <textarea
        id="adm-q"
        className="adm-input"
        rows={2}
        value={form.question}
        onChange={(e) => set({ question: e.target.value })}
        placeholder="Enter the question text…"
      />

      <div className="adm-label-row">
        <span className="adm-label">Options &amp; correct answer</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={addOption}
          disabled={form.options.length >= MAX_OPTIONS}
        >
          + Add option
        </button>
      </div>

      <div className="adm-options">
        {form.options.map((opt, idx) => (
          <div className="adm-option-row" key={idx}>
            <label className="adm-radio" title="Mark as correct answer">
              <input
                type="radio"
                name="correct"
                checked={form.correctIndex === idx}
                onChange={() => set({ correctIndex: idx })}
              />
              <span className="adm-radio-key">{String.fromCharCode(65 + idx)}</span>
            </label>
            <input
              className="adm-input"
              value={opt}
              onChange={(e) => setOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
            />
            <button
              type="button"
              className="adm-icon-btn"
              onClick={() => removeOption(idx)}
              disabled={form.options.length <= MIN_OPTIONS}
              aria-label={`Remove option ${idx + 1}`}
              title="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="adm-form-grid">
        <div>
          <label className="adm-label" htmlFor="adm-diff">
            Difficulty
          </label>
          <select
            id="adm-diff"
            className="adm-input"
            value={form.difficulty}
            onChange={(e) => set({ difficulty: e.target.value })}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d[0].toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="adm-label" htmlFor="adm-expl">
        Explanation <span className="text-muted-2">(optional)</span>
      </label>
      <textarea
        id="adm-expl"
        className="adm-input"
        rows={2}
        value={form.explanation}
        onChange={(e) => set({ explanation: e.target.value })}
        placeholder="Shown after answering. Optional but recommended."
      />

      {fieldError && <div className="alert alert-danger mt-2 mb-0">{fieldError}</div>}
      {serverError && <div className="alert alert-danger mt-2 mb-0">{serverError}</div>}

      <div className="adm-form-actions">
        <button type="submit" className="btn btn-gradient" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create question'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
