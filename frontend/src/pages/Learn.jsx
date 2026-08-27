import { useState, useMemo, useEffect } from "react";
import {
  GraduationCap,
  Search,
  CheckCircle2,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Clock,
  Sparkles,
  TrendingUp,
  Layers,
  Activity,
  ShieldCheck,
  Zap,
  Cpu,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { learnModules, learnTopics } from "../lib/learnData";
import usePageTitle from "../hooks/usePageTitle";
import { APP_TITLE } from "../lib/copy";

const ICON_MAP = {
  TrendingUp,
  Layers,
  Activity,
  ShieldCheck,
  Zap,
  Cpu,
};

const LOCAL_STORAGE_KEY = "tradeflow_completed_topics";

export default function Learn() {
  usePageTitle(`Academy — ${APP_TITLE.base}`);

  const [selectedModule, setSelectedModule] = useState("all");
  const [activeTopicId, setActiveTopicId] = useState(learnTopics[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [completedTopics, setCompletedTopics] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save completion state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...completedTopics]));
    } catch (e) {
      console.error("Failed to save completed topics:", e);
    }
  }, [completedTopics]);

  // Filter topics by selected module and search query
  const filteredTopics = useMemo(() => {
    let result = learnTopics;

    if (selectedModule !== "all") {
      result = result.filter((t) => t.moduleId === selectedModule);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.moduleTitle.toLowerCase().includes(q) ||
          t.content.some((c) => c.text && c.text.toLowerCase().includes(q))
      );
    }

    return result;
  }, [selectedModule, searchQuery]);

  // Active topic object
  const activeTopic = useMemo(() => {
    const found = learnTopics.find((t) => t.id === activeTopicId);
    if (found) return found;
    return filteredTopics[0] || learnTopics[0];
  }, [activeTopicId, filteredTopics]);

  // Ensure active topic stays valid when switching modules/search
  useEffect(() => {
    if (filteredTopics.length > 0) {
      const exists = filteredTopics.some((t) => t.id === activeTopicId);
      if (!exists) {
        setActiveTopicId(filteredTopics[0].id);
      }
    }
  }, [filteredTopics, activeTopicId]);

  // Previous & Next topic indices
  const currentTopicIndex = useMemo(
    () => learnTopics.findIndex((t) => t.id === activeTopic?.id),
    [activeTopic]
  );

  const prevTopic = currentTopicIndex > 0 ? learnTopics[currentTopicIndex - 1] : null;
  const nextTopic =
    currentTopicIndex >= 0 && currentTopicIndex < learnTopics.length - 1
      ? learnTopics[currentTopicIndex + 1]
      : null;

  const toggleCompleted = (topicId) => {
    setCompletedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
        toast.info("Topic marked as incomplete.");
      } else {
        next.add(topicId);
        toast.success("Topic completed! +10 XP Earned 🎉");
      }
      return next;
    });
  };

  const progressPct = Math.round((completedTopics.size / learnTopics.length) * 100) || 0;

  return (
    <div className="page academy-container">
      {/* ── Academy Hero Header ── */}
      <div className="academy-hero">
        <div className="academy-hero-left">
          <div className="academy-badge">
            <GraduationCap size={16} />
            <span>TRADEFLOW ACADEMY</span>
          </div>
          <h1 className="academy-title">Master Indian Derivatives & Quantitative Trading</h1>
          <p className="academy-subtitle">
            Structured modular lessons on Options Theory, The Greeks, Risk Management, and the Tradeflow Quant Engine.
          </p>
        </div>

        {/* Course Progress Card */}
        <div className="academy-progress-card">
          <div className="academy-progress-top">
            <div>
              <span className="academy-progress-label">Course Progress</span>
              <strong className="academy-progress-val">{progressPct}%</strong>
            </div>
            <Sparkles size={20} className="academy-sparkle-icon" />
          </div>

          <div className="academy-progress-track">
            <div className="academy-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>

          <div className="academy-progress-sub">
            {completedTopics.size} of {learnTopics.length} Topics Mastered
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="academy-toolbar">
        <div className="academy-search-wrap">
          <Search size={16} className="academy-search-icon" />
          <input
            type="text"
            className="academy-search-input"
            placeholder="Search topics (e.g. Theta, Delta, Stop Loss, GIFT Nifty)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="academy-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Module Filter Tabs */}
        <div className="academy-module-tabs">
          <button
            type="button"
            className={`chip ${selectedModule === "all" ? "active" : ""}`}
            onClick={() => setSelectedModule("all")}
          >
            All Modules ({learnTopics.length})
          </button>
          {learnModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              className={`chip ${selectedModule === mod.id ? "active" : ""}`}
              onClick={() => setSelectedModule(mod.id)}
            >
              Mod {mod.number}: {mod.title.split(":")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Master-Detail Academy Layout ── */}
      <div className="academy-main-grid">
        {/* Left Sidebar / Topic Navigator */}
        <div className="academy-sidebar">
          <div className="academy-sidebar-head">
            <span>Course Content ({filteredTopics.length})</span>
            {selectedModule !== "all" && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setSelectedModule("all")}
              >
                Show All
              </button>
            )}
          </div>

          <div className="academy-topic-list">
            {filteredTopics.length === 0 ? (
              <div className="academy-empty-search">No topics found matching "{searchQuery}"</div>
            ) : (
              filteredTopics.map((topic) => {
                const isActive = topic.id === activeTopic?.id;
                const isDone = completedTopics.has(topic.id);

                return (
                  <button
                    key={topic.id}
                    type="button"
                    className={`academy-topic-item ${isActive ? "active" : ""} ${
                      isDone ? "is-done" : ""
                    }`}
                    onClick={() => setActiveTopicId(topic.id)}
                  >
                    <div className="topic-item-left">
                      <CheckCircle2
                        size={16}
                        className={`topic-check-icon ${isDone ? "checked" : ""}`}
                      />
                      <div className="topic-item-text">
                        <span className="topic-item-title">{topic.title}</span>
                        <span className="topic-item-meta">
                          {topic.moduleTitle.split(":")[0]} · {topic.readTime}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="topic-arrow" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Article Reader View */}
        {activeTopic ? (
          <div className="academy-reader">
            {/* Article Top Header */}
            <div className="reader-header">
              <div>
                <div className="reader-breadcrumb">
                  {activeTopic.moduleTitle}
                </div>
                <h2 className="reader-title">{activeTopic.title}</h2>
                <div className="reader-meta">
                  <span className="reader-time-pill">
                    <Clock size={12} style={{ marginRight: 4 }} />
                    {activeTopic.readTime}
                  </span>
                  <span className="reader-summary-text">{activeTopic.summary}</span>
                </div>
              </div>

              {/* Complete Topic Action Button */}
              <button
                type="button"
                className={`btn btn-sm academy-complete-btn ${
                  completedTopics.has(activeTopic.id) ? "completed" : "btn-primary"
                }`}
                onClick={() => toggleCompleted(activeTopic.id)}
              >
                <CheckCircle2 size={15} />
                {completedTopics.has(activeTopic.id) ? "Completed (+10 XP)" : "Mark Completed (+10 XP)"}
              </button>
            </div>

            {/* Article Content Body */}
            <div className="reader-body">
              {activeTopic.content.map((block, idx) => {
                if (block.type === "p") {
                  return <p key={idx} className="reader-p">{block.text}</p>;
                }
                if (block.type === "h4") {
                  return <h3 key={idx} className="reader-h3">{block.text}</h3>;
                }
                if (block.type === "ul") {
                  return (
                    <ul key={idx} className="reader-ul">
                      {block.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "callout") {
                  const styleClass = block.style || "tip";
                  const icon =
                    styleClass === "tip"
                      ? "💡"
                      : styleClass === "warning"
                      ? "⚠️"
                      : "📌";

                  return (
                    <div key={idx} className={`reader-callout ${styleClass}`}>
                      <div className="callout-header">
                        <span className="callout-icon">{icon}</span>
                        <strong>{block.title}</strong>
                      </div>
                      <div className="callout-text">{block.text}</div>
                    </div>
                  );
                }
                return null;
              })}

              {/* Key Takeaways Card */}
              {activeTopic.takeaway && activeTopic.takeaway.length > 0 && (
                <div className="reader-takeaway-box">
                  <div className="takeaway-title">
                    <BookOpen size={16} color="var(--accent)" />
                    Key Takeaways
                  </div>
                  <ul>
                    {activeTopic.takeaway.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Bottom Footer Navigation */}
            <div className="reader-footer">
              {prevTopic ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm nav-prev"
                  onClick={() => setActiveTopicId(prevTopic.id)}
                >
                  <ChevronLeft size={16} />
                  <div>
                    <span className="nav-sub">Previous Lesson</span>
                    <span className="nav-title">{prevTopic.title}</span>
                  </div>
                </button>
              ) : (
                <div />
              )}

              {nextTopic ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm nav-next"
                  onClick={() => setActiveTopicId(nextTopic.id)}
                >
                  <div>
                    <span className="nav-sub">Next Lesson</span>
                    <span className="nav-title">{nextTopic.title}</span>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        ) : (
          <div className="academy-reader empty-reader">
            <GraduationCap size={32} color="var(--text-muted)" />
            <h3>Select a Topic to Start Learning</h3>
          </div>
        )}
      </div>
    </div>
  );
}
