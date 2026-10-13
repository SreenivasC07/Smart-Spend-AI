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

function updateLoginButton() {
    const loginButton = document.getElementById("loginButton");
    const logoutButton = document.getElementById("logoutButton");
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (USER_ID) {
        if (loginButton) loginButton.classList.add("hidden");
        if (logoutButton) logoutButton.classList.remove("hidden");
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${USER_NAME || "there"}`;
            welcomeMessage.classList.remove("hidden");
        }
    } else {
        if (loginButton) loginButton.classList.remove("hidden");
        if (logoutButton) logoutButton.classList.add("hidden");
        if (welcomeMessage) {
            welcomeMessage.textContent = "";
            welcomeMessage.classList.add("hidden");
        }
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
    updateLoginButton();

    const logoutUrl =
        `${COGNITO_DOMAIN}/logout` +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;

    window.location.assign(logoutUrl);
}


// ==========================================
// Load Expense History
// ==========================================

async function loadExpenses() {

    if (!USER_ID) {

        console.log(
            "User not authenticated."
        );

        return;

    }


    const idToken =
        getIdToken();


    if (!idToken) {

        console.error(
            "ID token not found."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/expenses`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${idToken}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load expenses"
            );

        }


        displayExpenses(
            data.expenses
        );


    } catch (error) {

        console.error(
            "Error loading expenses:",
            error
        );


        const emptyMessage =
            document.getElementById(
                "emptyMessage"
            );


        if (emptyMessage) {

            emptyMessage.textContent =
                "Unable to load expense history.";

        }

    }
}


// ==========================================
// Display Expenses
// ==========================================

function displayExpenses(expenses) {

    const tableBody =
        document.getElementById(
            "expenseTable"
        );

    const emptyMessage =
        document.getElementById(
            "emptyMessage"
        );


    tableBody.innerHTML = "";


    if (
        !expenses ||
        expenses.length === 0
    ) {

        emptyMessage.textContent =
            "No expenses added yet.";

        emptyMessage.style.display =
            "block";

        updateDashboard([]);

        return;

    }


    emptyMessage.style.display =
        "none";


    expenses.forEach(
        expense => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>
                    <button type="button" class="edit-expense-button">Edit</button>
                    <button type="button" class="delete-expense-button">Delete</button>
                </td>
            `;
            row.cells[0].textContent = expense.date || "";
            row.cells[1].textContent = expense.description || "";
            row.cells[2].textContent = `₹${expense.amount || "0"}`;
            row.cells[3].textContent = expense.category || "";
            row.querySelector(".edit-expense-button").addEventListener("click", () => editExpense(expense));
            row.querySelector(".delete-expense-button").addEventListener("click", () => deleteExpense(expense));

            tableBody.appendChild(
                row
            );

        }
    );


    updateDashboard(
        expenses
    );
}


// ==========================================
// Edit an expense
// ==========================================

async function editExpense(expense) {
    if (!getIdToken()) {
        alert("Please log in again before editing expenses.");
        return;
    }
    const description = prompt("Expense description:", expense.description || "");
    if (description === null) return;
    const amountText = prompt("Amount (₹):", expense.amount || "");
    if (amountText === null) return;
    const date = prompt("Date (YYYY-MM-DD):", expense.date || "");
    if (date === null) return;
    const categories = ["Food", "Education", "Transport", "Shopping", "Other"];
    const categoryHelp = categories.map((item, index) => `${index + 1}. ${item}`).join("\n");
    const categoryChoice = prompt(`Choose category by number:\n${categoryHelp}`, String(Math.max(0, categories.indexOf(expense.category)) + 1));
    if (categoryChoice === null) return;
    const category = categories[Number(categoryChoice) - 1];
    if (!description.trim() || !Number.isFinite(Number(amountText)) || Number(amountText) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !category) {
        alert("Please enter a description, a positive amount, a valid YYYY-MM-DD date, and a valid category.");
        return;
    }
    try {
        const response = await fetch(`${API_URL}/expenses/${encodeURIComponent(expense.expense_id)}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${getIdToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ description: description.trim(), amount: Number(amountText), date, category })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not update expense.");
        alert("Expense updated successfully.");
        await loadExpenses();
    } catch (error) {
        console.error("Error updating expense:", error);
        alert(`Could not update expense: ${error.message}`);
    }
}


// ==========================================
// Update Dashboard
// ==========================================


// ==========================================
// Delete an expense
// ==========================================

async function deleteExpense(expense) {
    if (!USER_ID) {
        alert("Please login before deleting an expense.");
        return;
    }

    const confirmed = confirm(
        `Delete "${expense.description}" (${formatINR(expense.amount)})? This cannot be undone.`
    );
    if (!confirmed) return;

    const idToken = getIdToken();
    if (!idToken) {
        alert("Authentication token not found. Please login again.");
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/expenses/${encodeURIComponent(expense.expense_id)}`,
            {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${idToken}` }
            }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || data.error || "Could not delete expense.");
        }
        alert(data.message || "Expense deleted successfully.");
        await loadExpenses();
    } catch (error) {
        console.error("Delete expense error:", error);
        alert(error.message || "Could not delete expense. Please try again.");
    }
}

function formatINR(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function expensesForMonth(expenses, monthValue) {
    return (expenses || []).filter(expense =>
        typeof expense.date === "string" && expense.date.slice(0, 7) === monthValue
    );
}

function totalForMonth(expenses, monthValue) {
    return expensesForMonth(expenses, monthValue).reduce(
        (sum, expense) => sum + (Number(expense.amount) || 0), 0
    );
}

function updateMonthlyComparison(expenses) {
    const monthInput = document.getElementById("comparisonMonth");
    if (!monthInput) return;
    const selectedMonth = monthInput.value || currentMonthValue();
    const previousMonth = monthOffset(selectedMonth, -1);
    const currentTotal = totalForMonth(expenses, selectedMonth);
    const previousTotal = totalForMonth(expenses, previousMonth);

    document.getElementById("currentMonthLabel").textContent = monthLabel(selectedMonth);
    document.getElementById("previousMonthLabel").textContent = monthLabel(previousMonth);
    document.getElementById("currentMonthTotal").textContent = formatINR(currentTotal);
    document.getElementById("previousMonthTotal").textContent = formatINR(previousTotal);

    const changeElement = document.getElementById("monthlyChange");
    if (previousTotal === 0) {
        changeElement.textContent = currentTotal === 0 ? "No spending" : "New spending";
    } else {
        const percentage = ((currentTotal - previousTotal) / previousTotal) * 100;
        changeElement.textContent = `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`;
    }

    const maxTotal = Math.max(currentTotal, previousTotal, 1);
    const chart = document.getElementById("monthlyChart");
    chart.innerHTML = `
        <div class="chart-row">
            <span>${escapeHtml(monthLabel(previousMonth))}</span>
            <div class="bar-track"><div class="bar previous-bar" style="width:${(previousTotal / maxTotal) * 100}%"></div></div>
            <strong>${formatINR(previousTotal)}</strong>
        </div>
        <div class="chart-row">
            <span>${escapeHtml(monthLabel(selectedMonth))}</span>
            <div class="bar-track"><div class="bar current-bar" style="width:${(currentTotal / maxTotal) * 100}%"></div></div>
            <strong>${formatINR(currentTotal)}</strong>
        </div>`;
    document.getElementById("monthlyComparisonMessage").textContent =
        currentTotal > previousTotal ? "Spending increased compared with the previous month." :
            currentTotal < previousTotal ? "Spending decreased compared with the previous month." :
                "Spending is the same for both months.";
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

async function loadBudget() {
    const month = document.getElementById("budgetMonth")?.value || currentMonthValue();
    const token = getIdToken();
    if (!USER_ID || !token) return;

    try {
        const response = await fetch(`${API_URL}/budget?month=${encodeURIComponent(month)}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || "Could not load budget.");

        document.getElementById("budgetAmount").value =
            data.budget && data.budget.amount != null ? data.budget.amount : "";
        document.getElementById("budgetLimit").textContent =
            data.budget && data.budget.amount != null ? formatINR(data.budget.amount) : "Not set";
        document.getElementById("budgetMessage").textContent =
            data.budget ? "Budget loaded for " + monthLabel(month) + "." : "No budget set for this month yet.";
        if (window.smartSpendExpenses) updateBudgetSpent(window.smartSpendExpenses);
    } catch (error) {
        console.error("Load budget error:", error);
        document.getElementById("budgetMessage").textContent =
            "Could not load budget. Confirm the /budget API route is configured after deployment.";
    }
}

function updateBudgetSpent(expenses) {
    window.smartSpendExpenses = expenses || [];
    const month = document.getElementById("budgetMonth")?.value || currentMonthValue();
    const spent = totalForMonth(expenses, month);
    document.getElementById("budgetSpent").textContent = formatINR(spent);

    const budgetText = document.getElementById("budgetLimit")?.textContent || "Not set";
    const limit = Number(String(budgetText).replace(/[₹,\s]/g, ""));
    const remainingElement = document.getElementById("budgetRemaining");
    const messageElement = document.getElementById("budgetMessage");
    if (!Number.isFinite(limit) || budgetText === "Not set" || limit <= 0) {
        remainingElement.textContent = "—";
        return;
    }
    const remaining = limit - spent;
    remainingElement.textContent = formatINR(remaining);
    if (remaining < 0) {
        messageElement.textContent = `Budget exceeded by ${formatINR(Math.abs(remaining))}.`;
        messageElement.className = "budget-message over-budget";
    } else if (spent >= limit * 0.8) {
        messageElement.textContent = "Warning: you have used at least 80% of this month's budget.";
        messageElement.className = "budget-message near-budget";
    } else {
        messageElement.textContent = "You are within your monthly budget.";
        messageElement.className = "budget-message";
    }
}

document.getElementById("budgetForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!USER_ID) {
        alert("Please login before setting a budget.");
        return;
    }
    const token = getIdToken();
    const month = document.getElementById("budgetMonth").value;
    const amount = Number(document.getElementById("budgetAmount").value);
    if (!token || !month || !Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid month and budget amount.");
        return;
    }
    try {
        const response = await fetch(`${API_URL}/budget`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ month, amount })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || "Could not save budget.");
        document.getElementById("budgetLimit").textContent = formatINR(amount);
        updateBudgetSpent(window.smartSpendExpenses || []);
        document.getElementById("budgetMessage").textContent = "Budget saved for " + monthLabel(month) + ".";
        alert("Monthly budget saved.");
    } catch (error) {
        console.error("Save budget error:", error);
        alert(error.message || "Could not save budget.");
    }
});

document.getElementById("comparisonMonth")?.addEventListener("change", () => {
    if (window.smartSpendExpenses) updateMonthlyComparison(window.smartSpendExpenses);
});
document.getElementById("budgetMonth")?.addEventListener("change", async () => {
    if (window.smartSpendExpenses) updateBudgetSpent(window.smartSpendExpenses);
    await loadBudget();
});


function updateDashboard(expenses) {

    let total = 0;

    let food = 0;
    let education = 0;
    let transport = 0;
    let shopping = 0;


    expenses.forEach(
        expense => {

            const amount =
                Number(
                    expense.amount
                );


            total += amount;


            switch (
            expense.category
            ) {

                case "Food":

                    food += amount;

                    break;


                case "Education":

                    education += amount;

                    break;


                case "Transport":

                    transport += amount;

                    break;


                case "Shopping":

                    shopping += amount;

                    break;

            }

        }
    );


    document.getElementById(
        "totalSpending"
    ).textContent =
        `₹${total}`;


    document.getElementById(
        "foodTotal"
    ).textContent =
        `₹${food}`;


    document.getElementById(
        "educationTotal"
    ).textContent =
        `₹${education}`;


    document.getElementById(
        "transportTotal"
    ).textContent =
        `₹${transport}`;


    document.getElementById(
        "shoppingTotal"
    ).textContent =
        `₹${shopping}`;

    updateMonthlyComparison(expenses);
    updateBudgetSpent(expenses);

}


// ==========================================
// Add Expense
// ==========================================

document.getElementById(
    "expenseForm"
).addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        if (!USER_ID) {

            alert(
                "Please login before adding an expense."
            );

            return;

        }


        const idToken =
            getIdToken();


        if (!idToken) {

            alert(
                "Authentication token not found. Please login again."
            );

            return;

        }


        const description =
            document.getElementById(
                "description"
            ).value;


        const amount =
            document.getElementById(
                "amount"
            ).value;


        const date =
            document.getElementById(
                "date"
            ).value;


        if (
            !description ||
            !amount ||
            !date
        ) {

            alert(
                "Please fill in all fields."
            );

            return;

        }


        try {

            const response =
                await fetch(
                    `${API_URL}/predict`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${idToken}`
                        },

                        body:
                            JSON.stringify({

                                description:
                                    description,

                                amount:
                                    amount,

                                date:
                                    date

                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Prediction failed"
                );

            }


            currentDescription =
                description;


            currentPrediction =
                data.category;


            document.getElementById(
                "predictionText"
            ).textContent =
                `AI Prediction: ${data.category} (${data.prediction_type})`;


            document.getElementById(
                "feedbackSection"
            ).classList.remove(
                "hidden"
            );


            await loadExpenses();


            document.getElementById(
                "expenseForm"
            ).reset();


        } catch (error) {

            console.error(
                "Error:",
                error
            );


            document.getElementById(
                "predictionText"
            ).textContent =
                "Unable to connect to AI backend.";


            alert(
                "Could not connect to the AWS backend."
            );

        }

    }
);


// ==========================================
// Accept Prediction
// ==========================================

document.getElementById(
    "acceptButton"
).addEventListener(
    "click",
    function () {

        alert(
            "AI prediction accepted!"
        );

    }
);


// ==========================================
// Correct Prediction
// ==========================================

document.getElementById(
    "correctButton"
).addEventListener(
    "click",
    async function () {

        if (!USER_ID) {

            alert(
                "Please login first."
            );

            return;

        }


        const idToken =
            getIdToken();


        if (!idToken) {

            alert(
                "Authentication token not found. Please login again."
            );

            return;

        }


        const correctCategory =
            prompt(
                "Enter the correct category:\nFood, Education, Transport, Shopping"
            );


        if (!correctCategory) {

            return;

        }


        try {

            const response =
                await fetch(
                    `${API_URL}/feedback`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${idToken}`
                        },

                        body:
                            JSON.stringify({

                                description:
                                    currentDescription,

                                category:
                                    correctCategory

                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Feedback failed"
                );

            }


            document.getElementById(
                "predictionText"
            ).textContent =
                `Corrected Category: ${correctCategory}`;


            alert(
                "Your correction has been learned by the AI!"
            );


        } catch (error) {

            console.error(
                "Error:",
                error
            );


            alert(
                "Could not save your correction."
            );

        }

    }
);


// ==========================================
// Initialize Application
// ==========================================

async function initializeApp() {

    // Check whether this is a Cognito callback.

    const authenticated =
        await handleCognitoCallback();


    // If callback didn't authenticate,
    // try restoring an existing session.

    if (!authenticated) {

        restoreUserSession();

    }


    updateLoginButton();


    // Initialize month selectors and load the user's data.

    const month = currentMonthValue();
    document.getElementById("comparisonMonth").value = month;
    document.getElementById("budgetMonth").value = month;

    if (USER_ID) {
        await loadExpenses();
        await loadBudget();
    }

}


// ==========================================
// Start application
// ==========================================

initializeApp();