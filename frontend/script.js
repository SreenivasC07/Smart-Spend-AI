const API_URL =
    "https://492yz9nirk.execute-api.us-east-1.amazonaws.com";

const COGNITO_DOMAIN =
    "https://us-east-1whxfjafcy.auth.us-east-1.amazoncognito.com";

const CLIENT_ID =
    "5ji215p5ttb0su6tcutit1qpvd";

const REDIRECT_URI =
    "https://d3jyz15ht8j14o.cloudfront.net";

const COGNITO_AUTH_URL =
    `${COGNITO_DOMAIN}/oauth2/authorize`;


// ==========================================
// Authenticated User
// ==========================================

let USER_ID = null;
let USER_NAME = null;

let currentDescription = "";
let currentPrediction = "";


// ==========================================
// Generate PKCE Code Verifier
// ==========================================

function generateRandomString(length = 64) {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    let result = "";

    const randomValues =
        new Uint32Array(length);

    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {

        result +=
            characters[randomValues[i] % characters.length];

    }

    return result;
}


// ==========================================
// Create PKCE Code Challenge
// ==========================================

async function createCodeChallenge(verifier) {

    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(verifier);

    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return btoa(
        String.fromCharCode(
            ...new Uint8Array(digest)
        )
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}


// ==========================================
// Login
// ==========================================

async function login() {

    const codeVerifier =
        generateRandomString();

    const codeChallenge =
        await createCodeChallenge(
            codeVerifier
        );

    sessionStorage.setItem(
        "pkce_code_verifier",
        codeVerifier
    );

    const loginUrl =
        `${COGNITO_AUTH_URL}` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&scope=openid+email+profile` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}`;

    window.location.href =
        loginUrl;
}


// ==========================================
// Decode JWT Payload
// ==========================================

function decodeJwtPayload(token) {

    const payload =
        token.split(".")[1];

    const base64 =
        payload
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const decoded =
        atob(base64);

    return JSON.parse(decoded);
}


// ==========================================
// Handle Cognito Callback
// ==========================================

async function handleCognitoCallback() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code =
        params.get("code");

    if (!code) {

        return false;

    }

    const codeVerifier =
        sessionStorage.getItem(
            "pkce_code_verifier"
        );

    if (!codeVerifier) {

        console.error(
            "PKCE code verifier not found."
        );

        return false;

    }

    try {

        const response =
            await fetch(
                `${COGNITO_DOMAIN}/oauth2/token`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        new URLSearchParams({

                            grant_type:
                                "authorization_code",

                            client_id:
                                CLIENT_ID,

                            code:
                                code,

                            redirect_uri:
                                REDIRECT_URI,

                            code_verifier:
                                codeVerifier

                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Cognito token error:",
                data
            );

            return false;

        }


        // ==================================
        // Save Authentication Tokens
        // ==================================

        sessionStorage.setItem(
            "id_token",
            data.id_token
        );

        sessionStorage.setItem(
            "access_token",
            data.access_token
        );


        if (data.refresh_token) {

            sessionStorage.setItem(
                "refresh_token",
                data.refresh_token
            );

        }


        // ==================================
        // Get Cognito User ID
        // ==================================

        const tokenPayload =
            decodeJwtPayload(
                data.id_token
            );

        USER_ID =
            tokenPayload.sub;
        USER_NAME = getDisplayName(tokenPayload);


        console.log(
            "Authenticated Cognito user:",
            USER_ID
        );


        // ==================================
        // Remove temporary PKCE verifier
        // ==================================

        sessionStorage.removeItem(
            "pkce_code_verifier"
        );


        // ==================================
        // Remove ?code= from browser URL
        // ==================================

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );


        console.log(
            "Cognito login successful."
        );

        return true;


    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );

        return false;

    }
}


// ==========================================
// Restore Existing Login Session
// ==========================================

function restoreUserSession() {

    const idToken =
        sessionStorage.getItem(
            "id_token"
        );


    if (!idToken) {

        return false;

    }


    try {

        const tokenPayload =
            decodeJwtPayload(
                idToken
            );

        USER_ID =
            tokenPayload.sub;
        USER_NAME = getDisplayName(tokenPayload);


        console.log(
            "Existing Cognito session restored:",
            USER_ID
        );


        return true;


    } catch (error) {

        console.error(
            "Could not restore session:",
            error
        );

        sessionStorage.removeItem(
            "id_token"
        );

        sessionStorage.removeItem(
            "access_token"
        );

        sessionStorage.removeItem(
            "refresh_token"
        );

        USER_ID = null;
        USER_NAME = null;

        return false;

    }
}


// ==========================================
// Get ID Token
// ==========================================

function getIdToken() {

    return sessionStorage.getItem(
        "id_token"
    );

}


// ==========================================
// User display name and account controls
// ==========================================

function getDisplayName(payload) {
    if (!payload) return "";

    const name = payload.name || payload.given_name || payload.preferred_username;
    if (name && String(name).trim()) return String(name).trim();

    const email = payload.email;
    if (email && String(email).trim()) return String(email).trim();

    const username = payload["cognito:username"];
    if (username && String(username).trim()) return String(username).trim();

    return "My account";
}

// ==========================================================
// SmartSpend AI - UI layer (everything below is the new interface)
// The Cognito login code above this line is unchanged.
// ==========================================================

const CATEGORIES = ["Food", "Education", "Transport", "Shopping", "Other"];

const CATEGORY_COLORS = {
    Food: "#f59e0b",
    Education: "#6366f1",
    Transport: "#0ea5e9",
    Shopping: "#ec4899",
    Other: "#64748b"
};

const ICON_EDIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

const ICON_DELETE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

const $ = id => document.getElementById(id);

const state = {
    expenses: [],
    budget: null,      // budget amount for the selected budget month (number or null)
    pending: null,     // expense just saved by /predict, waiting for confirmation
    editing: null,     // expense being edited
    deleting: null     // expense being deleted
};


// ==========================================================
// Small helpers
// ==========================================================

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function formatINR(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function todayValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function currentMonthValue() {
    return todayValue().slice(0, 7);
}

function monthOffset(monthValue, offset) {
    const [year, month] = (monthValue || currentMonthValue()).split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthValue) {
    if (!monthValue) return "Selected month";
    const [year, month] = monthValue.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
        month: "long", year: "numeric"
    });
}

function totalForMonth(expenses, monthValue) {
    return (expenses || [])
        .filter(e => typeof e.date === "string" && e.date.slice(0, 7) === monthValue)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

function setLoading(button, isLoading) {
    if (!button) return;
    button.classList.toggle("loading", isLoading);
    button.disabled = isLoading;
}

function showToast(message, type = "info") {
    const container = $("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
    toast.textContent = `${icon}  ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("leaving");
        setTimeout(() => toast.remove(), 260);
    }, 3800);
}


// ==========================================================
// Dark mode
// ==========================================================

function initTheme() {
    const toggle = $("themeToggle");
    const apply = theme => {
        document.documentElement.setAttribute("data-theme", theme);
        toggle.textContent = theme === "dark" ? "☀️" : "🌙";
    };

    apply(document.documentElement.getAttribute("data-theme") || "light");

    toggle.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        apply(next);
        try { localStorage.setItem("smartspend_theme", next); } catch (e) { /* ignore */ }
    });
}


// ==========================================================
// Modals
// ==========================================================

function openModal(id) {
    $(id).classList.remove("hidden");
    document.body.classList.add("modal-open");
    const focusTarget = $(id).querySelector("input:not([type=hidden]), select, button:not(.modal-close)");
    if (focusTarget) setTimeout(() => focusTarget.focus(), 50);
}

function closeModal(id) {
    $(id).classList.add("hidden");
    if (!document.querySelector(".modal-overlay:not(.hidden)")) {
        document.body.classList.remove("modal-open");
    }
}

document.querySelectorAll(".modal-overlay").forEach(overlay => {
    // click on the dark backdrop closes the modal
    overlay.addEventListener("mousedown", event => {
        if (event.target === overlay) closeModal(overlay.id);
    });
    // X button and Cancel buttons
    overlay.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => closeModal(overlay.id));
    });
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const open = document.querySelector(".modal-overlay:not(.hidden)");
    if (open) closeModal(open.id);
});


// ==========================================================
// API helper (adds the Cognito token and parses errors)
// ==========================================================

async function api(path, { method = "GET", body } = {}) {
    const token = getIdToken();

    if (!USER_ID || !token) {
        throw new Error("Please log in again.");
    }

    const headers = { "Authorization": `Bearer ${token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Your session expired. Please log in again.");
        }
        throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }

    return data;
}


// ==========================================================
// Login / logout view state
// ==========================================================

function greetingForNow() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

function updateLoginButton() {
    const loggedIn = Boolean(USER_ID);

    $("appLoader").classList.add("hidden");

    // Header controls
    $("loginButton").classList.toggle("hidden", loggedIn);
    $("logoutButton").classList.toggle("hidden", !loggedIn);
    $("welcomeMessage").classList.toggle("hidden", !loggedIn);
    $("userAvatar").classList.toggle("hidden", !loggedIn);

    // Whole pages: landing screen when logged out, dashboard when logged in
    $("loginScreen").classList.toggle("hidden", loggedIn);
    $("appMain").classList.toggle("hidden", !loggedIn);

    if (loggedIn) {
        const name = USER_NAME || "there";
        $("welcomeMessage").textContent = `Welcome, ${name}`;
        $("userAvatar").textContent = String(name).trim().charAt(0).toUpperCase() || "U";
        $("greeting").textContent = `${greetingForNow()}, ${String(name).split(/[ @]/)[0]}`;
        $("greetingSub").textContent = "Here is your spending overview.";
    } else {
        $("welcomeMessage").textContent = "";
    }
}

// Cognito hosted UI logout. The URI must match the allowed sign-out URL
// configured in the Cognito app client.
function logout() {
    ["id_token", "access_token", "refresh_token", "pkce_code_verifier"].forEach(key => {
        sessionStorage.removeItem(key);
    });

    USER_ID = null;
    USER_NAME = null;
    state.expenses = [];
    updateLoginButton();

    const logoutUrl =
        `${COGNITO_DOMAIN}/logout` +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;

    window.location.assign(logoutUrl);
}


// ==========================================================
// Load data
// ==========================================================

async function loadExpenses() {
    if (!USER_ID) return;

    try {
        const data = await api("/expenses");
        state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
        renderAll();
    } catch (error) {
        console.error("Error loading expenses:", error);
        showToast(error.message || "Unable to load expense history.", "error");
        $("emptyMessage").classList.remove("hidden");
        $("emptyMessage").querySelector("strong").textContent = "Unable to load expense history";
    }
}

async function loadBudget() {
    if (!USER_ID) return;

    const month = $("budgetMonth").value || currentMonthValue();

    try {
        const data = await api(`/budget?month=${encodeURIComponent(month)}`);
        const amount = data.budget && data.budget.amount != null ? Number(data.budget.amount) : null;
        state.budget = amount;
        $("budgetAmount").value = amount != null ? amount : "";
        renderBudget();
    } catch (error) {
        console.error("Load budget error:", error);
        state.budget = null;
        renderBudget();
        $("budgetMessage").textContent =
            "Could not load budget. Confirm the /budget API route is configured after deployment.";
        $("budgetMessage").className = "budget-message";
    }
}


// ==========================================================
// Rendering
// ==========================================================

function renderAll() {
    renderStats();
    renderDonut();
    renderMonthly();
    renderBudget();
    renderTable();
}

function categoryTotals() {
    const totals = { Food: 0, Education: 0, Transport: 0, Shopping: 0, Other: 0 };
    let total = 0;

    state.expenses.forEach(expense => {
        const amount = Number(expense.amount) || 0;
        total += amount;
        const key = CATEGORIES.includes(expense.category) ? expense.category : "Other";
        totals[key] += amount;
    });

    return { totals, total };
}

function renderStats() {
    const { totals, total } = categoryTotals();
    const percent = value => (total > 0 ? Math.round((value / total) * 100) : 0);

    $("totalSpending").textContent = formatINR(total);
    $("totalSub").textContent =
        `${state.expenses.length} expense${state.expenses.length === 1 ? "" : "s"} recorded`;

    [["food", "Food"], ["education", "Education"], ["transport", "Transport"], ["shopping", "Shopping"]]
        .forEach(([id, name]) => {
            $(`${id}Total`).textContent = formatINR(totals[name]);
            $(`${id}Pct`).textContent = `${percent(totals[name])}% of total`;
        });
}

function renderDonut() {
    const { totals, total } = categoryTotals();
    const donut = $("donut");
    const legend = $("donutLegend");

    $("donutTotal").textContent = formatINR(total);

    // Build the conic-gradient segments
    if (total > 0) {
        let start = 0;
        const stops = [];
        CATEGORIES.forEach(name => {
            if (totals[name] <= 0) return;
            const end = start + (totals[name] / total) * 100;
            stops.push(`${CATEGORY_COLORS[name]} ${start}% ${end}%`);
            start = end;
        });
        donut.style.background = `conic-gradient(${stops.join(", ")})`;
    } else {
        donut.style.background = "";
    }

    legend.innerHTML = CATEGORIES.map(name => {
        const pct = total > 0 ? Math.round((totals[name] / total) * 100) : 0;
        return `<li>
            <span class="dot" style="background:${CATEGORY_COLORS[name]}"></span>
            <span class="name">${name}</span>
            <span class="amt">${formatINR(totals[name])}</span>
            <span class="pct">${pct}%</span>
        </li>`;
    }).join("");
}

function renderMonthly() {
    const selected = $("comparisonMonth").value || currentMonthValue();
    const previous = monthOffset(selected, -1);
    const currentTotal = totalForMonth(state.expenses, selected);
    const previousTotal = totalForMonth(state.expenses, previous);

    $("currentMonthLabel").textContent = monthLabel(selected);
    $("previousMonthLabel").textContent = monthLabel(previous);
    $("currentMonthTotal").textContent = formatINR(currentTotal);
    $("previousMonthTotal").textContent = formatINR(previousTotal);

    const change = $("monthlyChange");
    change.className = "";

    if (previousTotal === 0) {
        change.textContent = currentTotal === 0 ? "No spending" : "New spending";
    } else {
        const pct = ((currentTotal - previousTotal) / previousTotal) * 100;
        change.textContent = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
        if (pct > 0) change.className = "up";
        if (pct < 0) change.className = "down";
    }

    const maxTotal = Math.max(currentTotal, previousTotal, 1);

    $("monthlyChart").innerHTML = `
        <div class="chart-row">
            <span>${escapeHtml(monthLabel(previous))}</span>
            <div class="bar-track"><div class="bar previous-bar" style="width:${(previousTotal / maxTotal) * 100}%"></div></div>
            <strong>${formatINR(previousTotal)}</strong>
        </div>
        <div class="chart-row">
            <span>${escapeHtml(monthLabel(selected))}</span>
            <div class="bar-track"><div class="bar current-bar" style="width:${(currentTotal / maxTotal) * 100}%"></div></div>
            <strong>${formatINR(currentTotal)}</strong>
        </div>`;

    $("monthlyComparisonMessage").textContent =
        currentTotal > previousTotal ? "Spending increased compared with the previous month." :
            currentTotal < previousTotal ? "Spending decreased compared with the previous month." :
                "Spending is the same for both months.";
}

function renderBudget() {
    const month = $("budgetMonth").value || currentMonthValue();
    const spent = totalForMonth(state.expenses, month);
    const limit = state.budget;

    $("budgetSpent").textContent = formatINR(spent);

    const bar = $("budgetBar");
    const track = $("budgetTrack");
    const message = $("budgetMessage");

    bar.className = "progress-fill";
    message.className = "budget-message";

    if (!limit || limit <= 0) {
        $("budgetLimit").textContent = "Not set";
        $("budgetRemaining").textContent = "—";
        $("budgetPercent").textContent = "No budget set";
        bar.style.width = "0%";
        track.setAttribute("aria-valuenow", "0");
        message.textContent = `No budget set for ${monthLabel(month)} yet.`;
        return;
    }

    const remaining = limit - spent;
    const pct = (spent / limit) * 100;

    $("budgetLimit").textContent = formatINR(limit);
    $("budgetRemaining").textContent = formatINR(remaining);
    $("budgetPercent").textContent = `${Math.round(pct)}% used`;
    bar.style.width = `${Math.min(pct, 100)}%`;
    track.setAttribute("aria-valuenow", String(Math.min(Math.round(pct), 100)));

    if (remaining < 0) {
        bar.classList.add("over");
        message.textContent = `Budget exceeded by ${formatINR(Math.abs(remaining))}.`;
        message.classList.add("over-budget");
    } else if (spent >= limit * 0.8) {
        bar.classList.add("warn");
        message.textContent = "Warning: you have used at least 80% of this month's budget.";
        message.classList.add("near-budget");
    } else {
        message.textContent = "You are within your monthly budget.";
    }
}

function renderTable() {
    const tbody = $("expenseTable");
    const empty = $("emptyMessage");
    const search = $("searchInput").value.trim().toLowerCase();
    const filter = $("filterCategory").value;

    tbody.innerHTML = "";

    // newest first
    const sorted = [...state.expenses].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
    );

    const rows = sorted.filter(expense =>
        (!filter || expense.category === filter) &&
        (!search || String(expense.description || "").toLowerCase().includes(search))
    );

    if (rows.length === 0) {
        empty.classList.remove("hidden");
        empty.querySelector("strong").textContent =
            state.expenses.length === 0 ? "No expenses added yet" : "No matching expenses";
        empty.querySelector("p").textContent =
            state.expenses.length === 0
                ? "Add your first expense above and the AI will categorize it for you."
                : "Try a different search or category filter.";
        return;
    }

    empty.classList.add("hidden");

    rows.forEach(expense => {
        const row = document.createElement("tr");
        const category = CATEGORIES.includes(expense.category) ? expense.category : "Other";

        const dateCell = document.createElement("td");
        dateCell.className = "date-cell";
        dateCell.textContent = expense.date || "";

        const descCell = document.createElement("td");
        descCell.textContent = expense.description || "";

        const catCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `badge badge-${category}`;
        badge.textContent = expense.category || "Other";
        catCell.appendChild(badge);

        const amountCell = document.createElement("td");
        amountCell.className = "num";
        amountCell.textContent = formatINR(expense.amount);

        const actionCell = document.createElement("td");
        const actionWrap = document.createElement("div");
        actionWrap.className = "row-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "icon-btn";
        editBtn.setAttribute("aria-label", "Edit expense");
        editBtn.title = "Edit";
        editBtn.innerHTML = ICON_EDIT;
        editBtn.addEventListener("click", () => openEditModal(expense));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "icon-btn danger";
        deleteBtn.setAttribute("aria-label", "Delete expense");
        deleteBtn.title = "Delete";
        deleteBtn.innerHTML = ICON_DELETE;
        deleteBtn.addEventListener("click", () => openDeleteModal(expense));

        actionWrap.append(editBtn, deleteBtn);
        actionCell.appendChild(actionWrap);
        row.append(dateCell, descCell, catCell, amountCell, actionCell);
        tbody.appendChild(row);
    });
}


// ==========================================================
// Add expense -> AI prediction popup
// ==========================================================

$("expenseForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!USER_ID) {
        showToast("Please login before adding an expense.", "error");
        return;
    }

    const description = $("description").value.trim();
    const amount = $("amount").value;
    const date = $("date").value;

    if (!description || !amount || Number(amount) <= 0 || !date) {
        showToast("Please fill in all fields with a valid amount.", "error");
        return;
    }

    const button = $("addButton");
    setLoading(button, true);

    try {
        // /predict predicts the category AND saves the expense
        const data = await api("/predict", {
            method: "POST",
            body: { description, amount, date }
        });

        currentDescription = description;
        currentPrediction = data.category;

        state.pending = {
            expense_id: data.expense_id,
            description,
            amount: Number(amount),
            date,
            category: data.category,
            type: data.prediction_type
        };

        $("expenseForm").reset();
        $("date").value = todayValue();

        showPredictionModal();
        loadExpenses(); // refresh the dashboard behind the popup
    } catch (error) {
        console.error("Error:", error);
        showToast(error.message || "Could not connect to the AWS backend.", "error");
    } finally {
        setLoading(button, false);
    }
});

function showPredictionModal() {
    const p = state.pending;
    if (!p) return;

    const category = CATEGORIES.includes(p.category) ? p.category : "Other";

    $("predMeta").textContent = `Expense saved · ${p.type || "AI"} prediction`;
    $("predBadge").className = `badge badge-lg badge-${category}`;
    $("predBadge").textContent = p.category;
    $("predDescription").textContent = p.description;
    $("predAmount").textContent = `${formatINR(p.amount)} · ${p.date}`;
    $("predCategorySelect").value = category;
    $("predCorrect").disabled = true;

    openModal("predictionModal");
}

$("predCategorySelect").addEventListener("change", () => {
    const p = state.pending;
    if (!p) return;
    const changed = $("predCategorySelect").value !== p.category;
    $("predCorrect").disabled = !changed;
});

$("predConfirm").addEventListener("click", () => {
    closeModal("predictionModal");
    showToast("Great! Category confirmed.", "success");
    state.pending = null;
});

$("predCorrect").addEventListener("click", async () => {
    const p = state.pending;
    if (!p) return;

    const category = $("predCategorySelect").value;
    const button = $("predCorrect");
    setLoading(button, true);

    try {
        // 1) fix the saved expense so the history shows the right category
        await api(`/expenses/${encodeURIComponent(p.expense_id)}`, {
            method: "PUT",
            body: {
                description: p.description,
                amount: p.amount,
                date: p.date,
                category
            }
        });

        // 2) teach the AI (non-fatal if this part fails)
        try {
            await api("/feedback", {
                method: "POST",
                body: { description: p.description, category }
            });
            showToast("Category updated. The AI will learn from this.", "success");
        } catch (feedbackError) {
            console.error("Feedback error:", feedbackError);
            showToast("Category updated, but AI feedback could not be saved.", "info");
        }

        state.pending = null;
        closeModal("predictionModal");
        await loadExpenses();
    } catch (error) {
        console.error("Correction error:", error);
        showToast(error.message || "Could not save your correction.", "error");
    } finally {
        setLoading(button, false);
        $("predCorrect").disabled = true;
    }
});


// ==========================================================
// Edit expense (replaces the old prompt() popups)
// ==========================================================

function openEditModal(expense) {
    state.editing = expense;
    $("editDescription").value = expense.description || "";
    $("editAmount").value = expense.amount != null ? Number(expense.amount) : "";
    $("editDate").value = expense.date || todayValue();
    $("editCategory").value = CATEGORIES.includes(expense.category) ? expense.category : "Other";
    openModal("editModal");
}

$("editForm").addEventListener("submit", async event => {
    event.preventDefault();

    const expense = state.editing;
    if (!expense) return;

    const description = $("editDescription").value.trim();
    const amount = Number($("editAmount").value);
    const date = $("editDate").value;
    const category = $("editCategory").value;

    if (!description || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        showToast("Enter a description, a positive amount and a valid date.", "error");
        return;
    }

    const button = $("editSave");
    setLoading(button, true);

    try {
        await api(`/expenses/${encodeURIComponent(expense.expense_id)}`, {
            method: "PUT",
            body: { description, amount, date, category }
        });

        closeModal("editModal");
        state.editing = null;
        showToast("Expense updated successfully.", "success");
        await loadExpenses();
    } catch (error) {
        console.error("Error updating expense:", error);
        showToast(error.message || "Could not update expense.", "error");
    } finally {
        setLoading(button, false);
    }
});


// ==========================================================
// Delete expense (replaces confirm())
// ==========================================================

function openDeleteModal(expense) {
    state.deleting = expense;
    $("confirmText").textContent =
        `"${expense.description}" (${formatINR(expense.amount)}) will be removed permanently. This cannot be undone.`;
    openModal("confirmModal");
}

$("confirmDelete").addEventListener("click", async () => {
    const expense = state.deleting;
    if (!expense) return;

    const button = $("confirmDelete");
    setLoading(button, true);

    try {
        const data = await api(`/expenses/${encodeURIComponent(expense.expense_id)}`, {
            method: "DELETE"
        });

        closeModal("confirmModal");
        state.deleting = null;
        showToast(data.message || "Expense deleted successfully.", "success");
        await loadExpenses();
    } catch (error) {
        console.error("Delete expense error:", error);
        showToast(error.message || "Could not delete expense.", "error");
    } finally {
        setLoading(button, false);
    }
});


// ==========================================================
// Budget form + filters
// ==========================================================

$("budgetForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!USER_ID) {
        showToast("Please login before setting a budget.", "error");
        return;
    }

    const month = $("budgetMonth").value;
    const amount = Number($("budgetAmount").value);

    if (!month || !Number.isFinite(amount) || amount <= 0) {
        showToast("Enter a valid month and budget amount.", "error");
        return;
    }

    const button = $("budgetSaveButton");
    setLoading(button, true);

    try {
        await api("/budget", { method: "PUT", body: { month, amount } });
        state.budget = amount;
        renderBudget();
        showToast(`Budget saved for ${monthLabel(month)}.`, "success");
    } catch (error) {
        console.error("Save budget error:", error);
        showToast(error.message || "Could not save budget.", "error");
    } finally {
        setLoading(button, false);
    }
});

$("comparisonMonth").addEventListener("change", renderMonthly);

$("budgetMonth").addEventListener("change", async () => {
    renderBudget();
    await loadBudget();
});

$("searchInput").addEventListener("input", renderTable);
$("filterCategory").addEventListener("change", renderTable);


// ==========================================================
// Initialize Application
// ==========================================================

async function initializeApp() {
    initTheme();

    try {
        // Check whether this is a Cognito callback.
        const authenticated = await handleCognitoCallback();

        // If callback didn't authenticate, try restoring an existing session.
        if (!authenticated) {
            restoreUserSession();
        }
    } catch (error) {
        console.error("Auth initialisation failed:", error);
    }

    const month = currentMonthValue();
    $("comparisonMonth").value = month;
    $("budgetMonth").value = month;
    $("date").value = todayValue();

    // Show the landing screen or the dashboard (this also hides the loader)
    updateLoginButton();

    if (USER_ID) {
        await Promise.all([loadExpenses(), loadBudget()]);
    }
}

// ==========================================================
// Start application
// ==========================================================

initializeApp();
