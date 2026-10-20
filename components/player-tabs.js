"use client";

import { useId, useRef, useState } from "react";

export default function PlayerTabs({ tabs }) {
    const [selected, setSelected] = useState(0);
    const id = useId();
    const buttons = useRef([]);

    function handleKeyDown(event, index) {
        let next;

        if (event.key === "ArrowRight") {
            next = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft") {
            next = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
            next = 0;
        } else if (event.key === "End") {
            next = tabs.length - 1;
        } else {
            return;
        }

        event.preventDefault();
        setSelected(next);
        buttons.current[next]?.focus();
    }

    return (
        <div>
            <div
                role="tablist"
                aria-label="Offensive analysis"
                className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-700"
            >
                {tabs.map((tab, index) => (
                    <button
                        key={tab.key}
                        ref={(element) => {
                            buttons.current[index] = element;
                        }}
                        type="button"
                        role="tab"
                        id={`${id}-tab-${tab.key}`}
                        aria-controls={`${id}-panel-${tab.key}`}
                        aria-selected={selected === index}
                        tabIndex={selected === index ? 0 : -1}
                        onClick={() => setSelected(index)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={`whitespace-nowrap border-b-2 pb-3 pt-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400 ${selected === index
                                ? "border-[#67bdec] text-white"
                                : "border-transparent text-slate-400 hover:text-white"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {tabs.map((tab, index) => (
                <div
                    key={tab.key}
                    role="tabpanel"
                    id={`${id}-panel-${tab.key}`}
                    aria-labelledby={`${id}-tab-${tab.key}`}
                    hidden={selected !== index}
                    tabIndex={0}
                    className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
                >
                    {tab.content}
                </div>
            ))}
        </div>
    );
}