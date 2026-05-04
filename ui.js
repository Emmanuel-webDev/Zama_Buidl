/**
 * ui.js — DOM rendering helpers
 */

export function showToast(msg, type = "info") {
  const container = document.getElementById("toast");
  const el = document.createElement("div");
  el.className = `toast-msg ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

export function setButtonLoading(btn, loading, defaultText) {
  if (loading) {
    btn.innerHTML = '<span class="spinner"></span> Loading...';
    btn.disabled = true;
  } else {
    btn.innerHTML = defaultText;
    btn.disabled = false;
  }
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderProposalCard(p, i, voted, onVote, onMark, onFinalize) {
  const title = p[0],
    description = p[1],
    proposer = p[2];
  const startTime = Number(p[3]),
    endTime = Number(p[4]);
  const status = Number(p[5]); // 0=Active 1=DecryptionPending 2=ResultFinalized
  const passed = p[6];
  const clearYes = Number(p[7]),
    clearNo = Number(p[8]);
  const totalVoters = Number(p[9]);
  const now = Math.floor(Date.now() / 1000);
  const isActive = status === 0 && now >= startTime && now <= endTime;
  const endDate = new Date(endTime * 1000).toLocaleString();

  let statusTag = "",
    resultHTML = "",
    actionsHTML = "";

  if (status === 2) {
    // ResultFinalized
    const total = clearYes + clearNo;
    const yesPct = total > 0 ? Math.round((clearYes / total) * 100) : 0;
    statusTag = passed
      ? '<span class="tag tag-passed">✓ PASSED</span>'
      : '<span class="tag tag-failed">✗ FAILED</span>';
    resultHTML = `
      <div class="result-reveal">
        <div class="result-label">// Decrypted Result — Final Tally</div>
        <div class="result-bar-wrap">
          <div class="result-bar-yes" style="width:${yesPct}%"></div>
        </div>
        <div class="result-counts">
          <span class="result-yes">✓ YES: ${clearYes} (${yesPct}%)</span>
          <span class="result-no">✗ NO: ${clearNo} (${100 - yesPct}%)</span>
        </div>
      </div>`;
  } else if (status === 1) {
    // DecryptionPending
    statusTag = '<span class="tag tag-closed">DECRYPTION PENDING</span>';
  } else if (isActive) {
    // Active
    statusTag = '<span class="tag tag-active">● VOTING ACTIVE</span>';
    if (voted) {
      actionsHTML = `<div class="voted-badge">✓ You voted (encrypted — ballot is secret)</div>`;
    }
  } else {
    // Closed, not yet marked
    statusTag = '<span class="tag tag-closed">CLOSED</span>';
  }

  const card = document.createElement("div");
  card.className = `proposal-card ${isActive ? "active" : ""}`;
  card.innerHTML = `
    <div class="proposal-meta">
      <span class="proposal-id">#${String(i).padStart(3, "0")}</span>
      ${statusTag}
    </div>
    <div class="proposal-title">${escapeHtml(title)}</div>
    <div class="proposal-desc">${escapeHtml(description)}</div>
    ${resultHTML}
    <div class="proposal-footer">
      <div class="proposal-info">
        👤 ${proposer.slice(0, 6)}...${proposer.slice(-4)} &nbsp;·&nbsp;
        🗳 ${totalVoters} voter${totalVoters !== 1 ? "s" : ""} &nbsp;·&nbsp;
        ⏱ ${isActive ? "Closes" : "Closed"}: ${endDate}
      </div>
      <div class="proposal-actions">${actionsHTML}</div>
    </div>`;

  // Attach action buttons via JS (no inline onclick — cleaner and CSP-safe)
  const actionsDiv = card.querySelector(".proposal-actions");

  if (status === 1) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost";
    btn.textContent = "🔓 Decrypt & Finalize";
    btn.addEventListener("click", () => onFinalize(i, btn));
    actionsDiv.appendChild(btn);
  } else if (isActive && !voted) {
    const yesBtn = document.createElement("button");
    yesBtn.className = "btn btn-yes";
    yesBtn.textContent = "🔐 Vote YES";
    yesBtn.addEventListener("click", (e) => {
      onVote(i, true, yesBtn); // pass button
    });

    const noBtn = document.createElement("button");
    noBtn.className = "btn btn-no";
    noBtn.textContent = "🔐 Vote NO";
    noBtn.addEventListener("click", (e) => {
      onVote(i, false, noBtn); // pass button
    });

    const row = document.createElement("div");
    row.className = "vote-actions";
    row.appendChild(yesBtn);
    row.appendChild(noBtn);
    actionsDiv.appendChild(row);
  } else if (status === 0 && !isActive) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost";
    btn.textContent = "🔓 Close & Mark Decryptable";
    btn.addEventListener("click", () => onMark(i, btn));
    actionsDiv.appendChild(btn);
  }

  return card;
}
