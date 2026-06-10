import { useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { learnContent } from "../lib/learnData";
import usePageTitle from "../hooks/usePageTitle";
import { APP_TITLE } from "../lib/copy";

export default function Learn() {
  usePageTitle(`Learn - ${APP_TITLE.base}`);

  return (
    <div className="page learn-container">
      <div className="learn-header">
        <h1 className="learn-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GraduationCap size={24} color="var(--accent)" />
          Tradeflow Academy
        </h1>
        <p className="learn-subtitle">
          Master the mechanics of Indian FnO markets and the Tradeflow methodology.
        </p>
      </div>

      <div className="lesson-list">
        {learnContent.map((lesson, index) => (
          <LessonCard key={lesson.id} lesson={lesson} defaultOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ lesson, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`lesson-card ${isOpen ? "is-open" : ""}`}>
      <button 
        type="button" 
        className="lesson-header" 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="lesson-title-block">
          <span className="lesson-title">{lesson.title}</span>
          <span className="lesson-summary">{lesson.summary}</span>
        </div>
        <ChevronDown size={20} className="lesson-icon" />
      </button>
      
      <div className="lesson-body">
        <div className="lesson-content">
          {lesson.content.map((block, idx) => {
            if (block.type === "p") {
              return <p key={idx}>{block.text}</p>;
            }
            if (block.type === "h4") {
              return <h4 key={idx}>{block.text}</h4>;
            }
            if (block.type === "ul") {
              return (
                <ul key={idx}>
                  {block.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
