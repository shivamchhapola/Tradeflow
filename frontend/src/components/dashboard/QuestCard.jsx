import { useState, useEffect, useMemo, useRef } from "react";
import {
  Target, CheckCircle2, XCircle, ArrowRight, BookOpen, AlertCircle,
  Clock, FileText, Moon, Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  getQuest,
  updateQuest,
  submitQuizAnswer,
  getRecentQuests,
} from "../../api";
import { QUEST, XP, SUCCESS, QUIZ_INTRO } from "../../lib/copy";
import { msToPhaseEnd, formatCountdown } from "../../lib/phaseClock";
import { formatISTDateShort } from "../../lib/time";
import useAnimatedSize from "../../hooks/useAnimatedSize";

// ── Phase end timer ──────────────────────────────────────────────────────────
function PhaseEndsIn({ phase, hidden, onPhaseEnd }) {
  const [ms, setMs] = useState(() => msToPhaseEnd(phase));
  useEffect(() => {
    if (hidden) return undefined;
    const currentMs = msToPhaseEnd(phase);
    setMs(currentMs);
    const pollMs = currentMs != null && currentMs < 60_000 ? 5_000 : 30_000;
    const id = setInterval(() => {
      const nextMs = msToPhaseEnd(phase);
      setMs(nextMs);
      if (nextMs != null && nextMs <= 0 && typeof onPhaseEnd === "function") {
        onPhaseEnd();
      }
    }, pollMs);
    return () => clearInterval(id);
  }, [phase, hidden, onPhaseEnd]);
  if (hidden || ms == null || ms <= 0) return null;
  return (
    <span
      style={{
        fontSize: 11,
        color: "var(--text-muted)",
        fontVariantNumeric: "tabular-nums",
      }}
      data-tooltip-id="global-tooltip"
      data-tooltip-content="When this phase ends, a new quest is generated for the next phase."
    >
      {QUEST.endsIn(formatCountdown(ms))}
    </span>
  );
}

// ── Recent quests dot strip ──────────────────────────────────────────────────
function RecentDots({ items }) {
  if (!items || items.length === 0) return null;

  const totalCorrect = items.reduce((acc, it) => acc + (it.correct_count || 0), 0);
  const totalQs = items.reduce((acc, it) => acc + (it.total_questions || 0), 0);
  const pct = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;

  // Render newest on the right (matches the human "timeline left-to-right" read)
  const ordered = [...items].slice(0, 5).reverse();
  const pad = Array.from({ length: Math.max(0, 5 - ordered.length) });

  return (
    <div
      className="reveal"
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 5 }}>
        {pad.map((_, i) => (
          <span key={`pad-${i}`} style={dotStyle("empty")} aria-hidden />
        ))}
        {ordered.map((it) => {
          const color = dotColor(it);
          const label = `${formatISTDateShort(it.date)} · ${capitalise(it.phase)} · ${
            it.status === "expired"
              ? "expired"
              : `${it.correct_count || 0}/${it.total_questions || 0}`
          }${it.xp_awarded ? ` · +${it.xp_awarded} XP` : ""}`;
          return (
            <span
              key={it.id}
              style={dotStyle(color)}
              data-tooltip-id="global-tooltip"
              data-tooltip-content={label}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
        {/* Use items.length so a fresh user with 2 quests sees "Last 2 quests"
            rather than "Last 5 runs" — the previous label lied about the
            denominator and was visually inconsistent with the dot count. */}
        Last {items.length} {items.length === 1 ? "quest" : "quests"}:{" "}
        {totalCorrect}/{totalQs} correct ({pct}%)
      </div>
    </div>
  );
}

function dotColor(item) {
  const c = item.correct_count || 0;
  const t = item.total_questions || 0;
  if (item.status === "expired") return "red";
  if (t === 0) return "empty";
  if (c === t) return "green";
  if (c === 0) return "red";
  return "amber";
}

function dotStyle(kind) {
  const base = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    border: "1px solid var(--border-strong)",
  };
  if (kind === "green") return { ...base, background: "var(--green)", borderColor: "var(--green-border)" };
  if (kind === "amber") return { ...base, background: "var(--amber)", borderColor: "var(--amber-border)" };
  if (kind === "red")   return { ...base, background: "var(--red)",   borderColor: "var(--red-border)" };
  return { ...base, background: "transparent" };
}

function capitalise(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// ── Multi-question panel ─────────────────────────────────────────────────────
function MultiQuizPanel({ questions, quest, onAnswer, onRefresh, submitting }) {
  const total = quest?.total_questions || questions.length;
  const results = quest?.quiz_results || [];
  const answeredIds = useMemo(() => new Set(results.map((r) => r.id)), [results]);
  const status = quest?.status || "pending";

  // Find current question = first unanswered, or null if all done.
  const currentIdx = useMemo(
    () => questions.findIndex((q) => !answeredIds.has(q.id)),
    [questions, answeredIds],
  );
  const current = currentIdx >= 0 ? questions[currentIdx] : null;

  // Local UI state for the most recent answer (correct/explanation come from
  // the server after we submit).
  const [pendingFeedback, setPendingFeedback] = useState(null);
  // pendingFeedback shape: { questionId, selected, correct, correctAnswer, explanation, xp_awarded, quest_complete }

  // Clear feedback when the quest's question advances (i.e. user moved on).
  useEffect(() => {
    if (pendingFeedback && !answeredIds.has(pendingFeedback.questionId)) {
      setPendingFeedback(null);
    }
  }, [answeredIds, pendingFeedback]);

  const handlePick = async (opt) => {
    if (!current || submitting) return;
    try {
      const res = await onAnswer(current.id, opt);
      setPendingFeedback({
        questionId: current.id,
        selected: opt,
        correct: res.correct,
        correctAnswer: res.correct_answer,
        explanation: res.explanation,
        xpAwarded: res.xp_awarded,
        questComplete: res.quest_complete,
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Couldn't submit your answer.";
      if (err?.response?.status === 409) {
        toast(msg);
        onRefresh?.();
      } else {
        toast.error(msg);
      }
    }
  };

  const handleNext = () => setPendingFeedback(null);

  // ── Completed view ───────────────────────────────────────────────────────
  if (status === "completed") {
    const correctCount = quest.correct_count || 0;
    return (
      <div className="reveal">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 12,
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        >
          <Trophy size={18} color="var(--xp)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {QUEST.completedTitle}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {correctCount} / {total} correct ·{" "}
              <span style={{ color: "var(--xp)", fontWeight: 600 }}>
                +{quest.xp_awarded || 0} XP
              </span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
          Come back for the next phase's quest.
        </div>
      </div>
    );
  }

  // ── In progress: show current question OR last feedback ─────────────────
  const showingFeedback =
    pendingFeedback && answeredIds.has(pendingFeedback.questionId);

  const progressIdx = Math.min(results.length + 1, total);
  const progressPct = Math.min(100, (results.length / total) * 100);

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
            fontSize: 11,
            color: "var(--text-muted)",
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          <span>{QUEST.questionOf(Math.min(progressIdx, total), total)}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {results.filter((r) => r.correct).length} / {total} correct
          </span>
        </div>
        <div
          style={{
            height: 3,
            background: "var(--bg-surface)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "var(--accent)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {showingFeedback ? (
        <FeedbackBlock
          feedback={pendingFeedback}
          questions={questions}
          onNext={handleNext}
        />
      ) : current ? (
        // key on the question id so each new question gets its own fade-in
        // pass instead of looking like the same DOM mutated in place.
        <div className="reveal-fast" key={current.id}>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-primary)",
              marginBottom: 14,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {current.question}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {current.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handlePick(opt)}
                disabled={submitting}
                className="quest-option"
                style={{
                  padding: "11px 13px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  textAlign: "left",
                  cursor: submitting ? "default" : "pointer",
                  fontSize: 13,
                  fontFamily: "var(--font)",
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackBlock({ feedback, questions, onNext }) {
  const q = questions.find((x) => x.id === feedback.questionId);
  if (!q) return null;
  return (
    <div className="reveal">
      <div
        style={{
          fontSize: 14,
          color: "var(--text-primary)",
          marginBottom: 14,
          fontWeight: 500,
          lineHeight: 1.55,
        }}
      >
        {q.question}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.options.map((opt) => {
          const isCorrect = opt === feedback.correctAnswer;
          const isSelected = opt === feedback.selected;
          let bg = "var(--bg-surface)";
          let border = "1px solid var(--border)";
          let color = "var(--text-primary)";
          if (isCorrect) {
            bg = "var(--green-bg)";
            border = "1px solid var(--green-border)";
            color = "var(--green)";
          } else if (isSelected) {
            bg = "var(--red-bg)";
            border = "1px solid var(--red-border)";
            color = "var(--red)";
          }
          return (
            <div
              key={opt}
              style={{
                padding: "11px 13px",
                background: bg,
                border,
                borderRadius: "var(--radius-sm)",
                color,
                fontSize: 13,
                opacity: !isSelected && !isCorrect ? 0.55 : 1,
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: feedback.correct ? "var(--green)" : "var(--text-muted)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {feedback.correct ? (
          <>
            <CheckCircle2 size={14} /> {XP.questCorrect}
          </>
        ) : (
          <>
            <XCircle size={14} /> {XP.questWrong}
          </>
        )}
      </div>
      <div
        style={{
          marginTop: 10,
          padding: 10,
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.55,
        }}
      >
        {feedback.explanation}
      </div>
      {!feedback.questComplete && (
        <button
          type="button"
          onClick={onNext}
          className="btn btn-ghost btn-block"
          style={{ marginTop: 12 }}
        >
          {QUEST.nextCta} <ArrowRight size={14} />
        </button>
      )}
      {feedback.questComplete && feedback.xpAwarded > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "var(--xp-bg)",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: "var(--radius-sm)",
            color: "var(--xp)",
            fontWeight: 600,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {QUEST.completedTitle} · +{feedback.xpAwarded} XP
        </div>
      )}
    </div>
  );
}

function PendingReportsBanner({ count, navigate }) {
  if (!count || count <= 0) return null;
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--amber-bg, rgba(245, 158, 11, 0.1))",
        border: "1px solid var(--amber-border, rgba(245, 158, 11, 0.3))",
        borderRadius: "var(--radius-sm)",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--amber)", fontWeight: 500 }}>
        <FileText size={15} />
        <span>
          {count === 1
            ? "1 closed trade waiting for mentor report (+10 XP)"
            : `${count} closed trades waiting for mentor reports (+10 XP)`}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => navigate("/reports")}
        style={{
          color: "var(--amber)",
          borderColor: "var(--amber-border, rgba(245, 158, 11, 0.3))",
          whiteSpace: "nowrap",
          fontSize: 11,
          padding: "4px 8px",
        }}
      >
        View Reports <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ── Main card ────────────────────────────────────────────────────────────────
export default function QuestCard({ score, metrics, sessionLabel }) {
  void score; void metrics; void sessionLabel;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState([]);
  const navigate = useNavigate();

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getQuest().catch(() => null),
      getRecentQuests(5).catch(() => []),
    ]).then(([qData, rData]) => {
      setData(qData);
      setRecent(rData || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getQuest().catch(() => null),
      getRecentQuests(5).catch(() => []),
    ]).then(([qData, rData]) => {
      if (cancelled) return;
      setData(qData);
      setRecent(rData || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleAnswer = async (questionId, answer) => {
    setSubmitting(true);
    try {
      const res = await submitQuizAnswer(questionId, answer);
      setData((prev) => {
        if (!prev) return prev;
        const prevResults = prev.quest?.quiz_results || [];
        const nextResults = [
          ...prevResults,
          { id: questionId, answer, correct: res.correct, answered_at: new Date().toISOString() },
        ];
        const correctCount = nextResults.filter((r) => r.correct).length;
        return {
          ...prev,
          quest: {
            ...prev.quest,
            quiz_results: nextResults,
            correct_count: correctCount,
            status: res.quest_complete ? "completed" : prev.quest.status,
            xp_awarded: res.quest_complete ? res.xp_awarded : prev.quest.xp_awarded,
          },
        };
      });
      if (res.quest_complete) {
        getRecentQuests(5).then(setRecent).catch(() => {});
        if (res.xp_awarded > 0) {
          toast.success(`${QUEST.completedTitle} · +${res.xp_awarded} XP`);
        }
      }
      setSubmitting(false);
      return res;
    } catch (err) {
      setSubmitting(false);
      throw err;
    }
  };

  if (loading) {
    return (
      <CardShell
        icon={<Target size={16} color="var(--text-muted)" />}
        title={QUEST.todaysQuest}
        accent="var(--border)"
        phase="loading"
        hideTimer
      >
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      </CardShell>
    );
  }

  const phase = data?.phase || "premarket";
  const naturalPhase = data?.natural_phase || phase;
  const effectivePhase = phase === "pending_reports" ? naturalPhase : phase;
  const quest = data?.quest || {};
  const questions = data?.questions || [];
  const intro = QUIZ_INTRO[effectivePhase] || QUIZ_INTRO[naturalPhase] || "";
  const pendingReportsCount = data?.pending_reports || 0;

  const hideTimer = quest.status === "completed";

  // ── Generic Quiz Panel logic ─────────────────────────────────────────────
  const renderQuizContent = () => (
    <>
      <PendingReportsBanner count={pendingReportsCount} navigate={navigate} />
      <Intro text={intro} />
      <MultiQuizPanel
        questions={questions}
        quest={quest}
        onAnswer={handleAnswer}
        onRefresh={loadAll}
        submitting={submitting}
      />
    </>
  );

  // ── Weekend ──────────────────────────────────────────────────────────────
  if (effectivePhase === "weekend") {
    return (
      <CardShell
        icon={<Moon size={16} color="var(--blue)" />}
        title="Weekend"
        accent="var(--blue)"
        phase={naturalPhase}
        hideTimer={hideTimer}
        onPhaseEnd={loadAll}
      >
        {renderQuizContent()}
        <RecentDots items={recent} />
      </CardShell>
    );
  }

  // ── Early (before 9 AM weekday) ──────────────────────────────────────────
  if (effectivePhase === "early") {
    return (
      <CardShell
        icon={<Clock size={16} color="var(--text-muted)" />}
        title="Pre-open"
        pillVariant="muted"
        pillText="Opens 9:15 IST"
        accent="var(--border)"
        phase={naturalPhase}
        hideTimer={hideTimer}
        onPhaseEnd={loadAll}
      >
        {renderQuizContent()}
        <RecentDots items={recent} />
      </CardShell>
    );
  }

  // ── Premarket (9:00–9:15) ────────────────────────────────────────────────
  if (effectivePhase === "premarket") {
    const isAccepted = quest.status === "accepted";
    const isCompleted = quest.status === "completed";
    const accent = isCompleted ? "var(--green)" : isAccepted ? "var(--accent)" : "var(--border)";
    return (
      <CardShell
        icon={<Target size={16} color={isCompleted ? "var(--green)" : "var(--accent)"} />}
        title={QUEST.todaysQuest}
        pillVariant={isAccepted ? "accent" : "muted"}
        pillText={isAccepted ? "Active" : "9:00–9:15"}
        accent={accent}
        phase={naturalPhase}
        hideTimer={hideTimer}
        onPhaseEnd={loadAll}
      >
        {renderQuizContent()}
        {!isAccepted && !isCompleted && (
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              try {
                await updateQuest({ status: "accepted" });
                setData((prev) => ({ ...prev, quest: { ...prev.quest, status: "accepted" } }));
                toast.success(SUCCESS.questAccepted);
              } catch {
                toast.error("Couldn't accept the quest.");
              }
              setSubmitting(false);
            }}
            disabled={submitting}
            className="btn btn-ghost btn-block"
            style={{ marginTop: 12 }}
          >
            {submitting ? QUEST.acceptingCta : QUEST.acceptCta}
          </button>
        )}
        {isAccepted && (
          <button
            type="button"
            onClick={() => navigate("/trade")}
            className="btn btn-quest btn-block"
            style={{ marginTop: 12 }}
          >
            {QUEST.enterTrading} <ArrowRight size={14} />
          </button>
        )}
        <RecentDots items={recent} />
      </CardShell>
    );
  }

  // ── Intraday ─────────────────────────────────────────────────────────────
  if (effectivePhase === "intraday") {
    const isCompleted = quest.status === "completed";
    return (
      <CardShell
        icon={<Target size={16} color={isCompleted ? "var(--green)" : "var(--accent)"} />}
        title={QUEST.activeQuest}
        pillVariant="accent"
        pillText="Live"
        accent={isCompleted ? "var(--green)" : "var(--accent)"}
        phase={naturalPhase}
        hideTimer={hideTimer}
        onPhaseEnd={loadAll}
      >
        {renderQuizContent()}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-muted)",
            fontSize: 11,
            marginTop: 10,
          }}
        >
          <AlertCircle size={12} /> {QUEST.awaitingVerify}
        </div>
        <RecentDots items={recent} />
      </CardShell>
    );
  }

  // ── Postmarket / Default ──────────────────────────────────────────────────
  return (
    <CardShell
      icon={<BookOpen size={16} color="var(--quest)" />}
      title={QUEST.postQuiz}
      accent="var(--quest)"
      phase={naturalPhase}
      hideTimer={hideTimer}
      onPhaseEnd={loadAll}
    >
      {renderQuizContent()}
      <RecentDots items={recent} />
    </CardShell>
  );
}

// ── Reusable shell so phase branches stay readable ───────────────────────────
function CardShell({ icon, title, pillVariant, pillText, accent, phase, hideTimer, onPhaseEnd, children }) {
  // Smoothly animate the card's height when content grows/shrinks (feedback
  // block appearing, recent dot strip mounting, completion summary, etc.).
  // The hook captures the old height in useLayoutEffect BEFORE the browser
  // paints the new one, so the user never sees a snap.
  const shellRef = useRef(null);
  useAnimatedSize(shellRef);
  return (
    <div className="card" ref={shellRef} style={{ borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {icon}
        <div className="card-title" style={{ margin: 0 }}>{title}</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {pillText && (
            <span className={`pill pill-${pillVariant}`}>{pillText}</span>
          )}
          <PhaseEndsIn phase={phase} hidden={hideTimer} onPhaseEnd={onPhaseEnd} />
        </div>
      </div>
      {children}
    </div>
  );
}

function Intro({ text }) {
  if (!text) return null;
  return (
    <div
      style={{
        fontSize: 12,
        // --text-secondary clears WCAG AAA on --bg-card; --text-muted only
        // hits ~4.2:1 which fails AA for 12px body text. Quest copy is
        // important reading, not decorative — give it the higher contrast.
        color: "var(--text-secondary)",
        lineHeight: 1.55,
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  );
}
