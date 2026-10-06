const API_URL = "https://492yz9nirk.execute-api.us-east-1.amazonaws.com";

const USER_ID = "demo_user";

let currentDescription = "";
let currentPrediction = "";


// ==========================================
// Load Expense History
// ==========================================

async function loadExpenses() {

    try {

        const response = await fetch(
            `${API_URL}/expenses?user_id=${USER_ID}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load expenses");
        }

        displayExpenses(data.expenses);

    } catch (error) {

        console.error("Error loading expenses:", error);

        document.getElementById("emptyMessage").textContent =
            "Unable to load expense history.";

    }
}


// ==========================================
// Display Expenses
// ==========================================

function displayExpenses(expenses) {

    const tableBody = document.getElementById("expenseTable");
    const emptyMessage = document.getElementById("emptyMessage");

    tableBody.innerHTML = "";

    if (!expenses || expenses.length === 0) {

        emptyMessage.textContent = "No expenses added yet.";
        emptyMessage.style.display = "block";

        updateDashboard([]);

        return;
    }

    emptyMessage.style.display = "none";

    expenses.forEach(expense => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${expense.date}</td>
            <td>${expense.description}</td>
            <td>₹${expense.amount}</td>
            <td>${expense.category}</td>
        `;

        tableBody.appendChild(row);

    });

    updateDashboard(expenses);
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


    expenses.forEach(expense => {

        const amount = Number(expense.amount);

        total += amount;


        switch (expense.category) {

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

    });


    document.getElementById("totalSpending").textContent =
        `₹${total}`;

    document.getElementById("foodTotal").textContent =
        `₹${food}`;

    document.getElementById("educationTotal").textContent =
        `₹${education}`;

    document.getElementById("transportTotal").textContent =
        `₹${transport}`;

    document.getElementById("shoppingTotal").textContent =
        `₹${shopping}`;

}


// ==========================================
// Add Expense
// ==========================================

document.getElementById("expenseForm").addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const description =
            document.getElementById("description").value;

        const amount =
            document.getElementById("amount").value;

        const date =
            document.getElementById("date").value;


        if (!description || !amount || !date) {

            alert("Please fill in all fields.");

            return;
        }


        try {

            const response = await fetch(
                `${API_URL}/predict`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        user_id: USER_ID,

                        description: description,

                        amount: amount,

                        date: date

                    })

                }
            );


            const data = await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error || "Prediction failed"
                );

            }


            // Save current expense information

            currentDescription = description;

            currentPrediction = data.category;


            // Display AI prediction

            document.getElementById(
                "predictionText"
            ).textContent =
                `AI Prediction: ${data.category} (${data.prediction_type})`;


            // Show feedback buttons

            document.getElementById(
                "feedbackSection"
            ).classList.remove("hidden");


            // Reload expenses from DynamoDB

            await loadExpenses();


            // Clear form

            document.getElementById("expenseForm").reset();


        } catch (error) {

            console.error("Error:", error);


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


        const correctCategory = prompt(
            "Enter the correct category:\nFood, Education, Transport, Shopping"
        );


        if (!correctCategory) {

            return;

        }


        try {

            const response = await fetch(
                `${API_URL}/feedback`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        user_id: USER_ID,

                        description: currentDescription,

                        category: correctCategory

                    })

                }
            );


            const data = await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error || "Feedback failed"
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

            console.error("Error:", error);


            alert(
                "Could not save your correction."
            );

        }

    }
);


// ==========================================
// Load expenses when page opens
// ==========================================

loadExpenses();