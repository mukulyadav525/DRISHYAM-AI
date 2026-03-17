/**
 * SENTINEL-ML: Classifier UI — JavaScript
 * Communicates with the FastAPI server running on port 8001.
 */

const API_BASE = "http://localhost:8001";

function getVal(id) {
  return document.getElementById(id).value;
}

function setLoading(flag) {
  const btn = document.getElementById("classify-btn");
  const icon = document.getElementById("btn-icon");
  const text = document.getElementById("btn-text");
  btn.disabled = flag;
  text.textContent = flag ? "Classifying…" : "Classify";
  icon.style.display = flag ? "none" : "";
  if (flag) {
    const spinner = document.createElement("svg");
    spinner.id = "spinner-icon";
    spinner.setAttribute("width", "18");
    spinner.setAttribute("height", "18");
    spinner.setAttribute("viewBox", "0 0 24 24");
    spinner.innerHTML = `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" style="animation:spin 0.8s linear infinite;transform-origin:center"/>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    btn.prepend(spinner);
  } else {
    document.getElementById("spinner-icon")?.remove();
  }
}

function showResult(data) {
  const panel = document.getElementById("result-panel");
  panel.classList.remove("hidden");
  document.getElementById("error-panel").classList.add("hidden");

  // Badge
  const badge = document.getElementById("verdict-badge");
  badge.textContent = data.label;
  badge.className = "verdict-badge";
  if (data.label === "SAFE") badge.classList.add("badge-safe");
  else if (data.label === "SUSPICIOUS") badge.classList.add("badge-suspicious");
  else badge.classList.add("badge-scam");

  // Confidence bar
  const conf = data.confidence;
  const bar = document.getElementById("conf-bar");
  bar.style.width = "0%";
  bar.style.background =
    data.label === "SAFE" ? "#16a34a" :
    data.label === "SUSPICIOUS" ? "#F97316" : "#DC2626";
  document.getElementById("conf-value").textContent = `${conf}%`;
  setTimeout(() => { bar.style.width = `${conf}%`; }, 50);

  // Probabilities
  document.getElementById("prob-safe").textContent = `${data.probabilities.SAFE}%`;
  document.getElementById("prob-susp").textContent = `${data.probabilities.SUSPICIOUS}%`;
  document.getElementById("prob-scam").textContent = `${data.probabilities.SCAM}%`;

  // Explanations
  const list = document.getElementById("explain-list");
  list.innerHTML = "";
  (data.explanations || []).forEach(exp => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="explain-feature">${exp.label}</span>
      <span class="explain-value">val: ${exp.value}</span>
      <span class="explain-imp">${exp.importance}% weight</span>
    `;
    list.appendChild(li);
  });
}

function showError(msg) {
  document.getElementById("error-panel").classList.remove("hidden");
  document.getElementById("result-panel").classList.add("hidden");
  document.getElementById("error-msg").textContent = msg;
}

async function classifyNumber() {
  const phone = getVal("phone").trim();
  if (!phone) {
    showError("Please enter a phone number.");
    return;
  }

  setLoading(true);

  const body = {
    phone_number: phone,
    call_velocity: parseInt(getVal("call_velocity")) || 0,
    rep_score: parseFloat(getVal("rep_score")) || 0.0,
    report_count: parseInt(getVal("report_count")) || 0,
    sim_age_days: parseInt(getVal("sim_age_days")) || 365,
    is_vpa_linked: parseInt(getVal("is_vpa_linked")) || 0,
    avg_call_duration: parseFloat(getVal("avg_call_duration")) || 60.0,
    geographic_anomaly: parseInt(getVal("geographic_anomaly")) || 0,
    honeypot_hits: parseInt(getVal("honeypot_hits")) || 0,
    scam_network_degree: parseInt(getVal("scam_network_degree")) || 0,
  };

  try {
    const res = await fetch(`${API_BASE}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `API Error ${res.status}`);
    }

    const data = await res.json();
    showResult(data);
  } catch (e) {
    if (e.message.includes("Failed to fetch")) {
      showError("Cannot reach the ML API. Is the server running on port 8001?");
    } else {
      showError(e.message);
    }
  } finally {
    setLoading(false);
  }
}

// Allow Enter key to trigger classify
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("phone").addEventListener("keydown", (e) => {
    if (e.key === "Enter") classifyNumber();
  });

  // Reflect the actual API base in footer
  document.getElementById("api-url").textContent = API_BASE;
});
