"use client";

import { useEffect, useState } from "react";

export function DisplayControls() {
  const [dark, setDark] = useState(false);
  const [lowData, setLowData] = useState(false);

  useEffect(() => {
    const initialDark = localStorage.getItem("theme") === "dark";
    const initialLowData = localStorage.getItem("low_data") === "1";
    setDark(initialDark);
    setLowData(initialLowData);
    applySettings(initialDark, initialLowData);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    applySettings(next, lowData);
  };

  const toggleLowData = () => {
    const next = !lowData;
    setLowData(next);
    localStorage.setItem("low_data", next ? "1" : "0");
    applySettings(dark, next);
  };

  return (
    <div className="display-controls">
      <button type="button" className="btn btn-ghost" onClick={toggleDark}>
        {dark ? "Aydinlik" : "Karanlik"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={toggleLowData}>
        {lowData ? "Normal" : "Dusuk Veri"}
      </button>
    </div>
  );
}

function applySettings(dark: boolean, lowData: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-low-data", lowData ? "1" : "0");
}
