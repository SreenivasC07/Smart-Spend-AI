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
// Update Login Button
// ==========================================

function updateLoginButton() {

    const loginButton =
        document.getElementById(
            "loginButton"
        );


    if (!loginButton) {

        return;

    }


    if (USER_ID) {

        loginButton.textContent =
            "Logged In";

        loginButton.disabled =
            true;

    } else {

        loginButton.textContent =
            "Login";

        loginButton.disabled =
            false;

    }
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
                <td>${expense.date}</td>
                <td>${expense.description}</td>
                <td>₹${expense.amount}</td>
                <td>${expense.category}</td>
            `;


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
// Update Dashboard
// ==========================================

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


    // Load expenses only for authenticated users.

    if (USER_ID) {

        await loadExpenses();

    }

}


// ==========================================
// Start application
// ==========================================

initializeApp();