const API_URL = "https://492yz9nirk.execute-api.us-east-1.amazonaws.com";

const USER_ID = "demo_user";

let currentDescription = "";
let currentPrediction = "";


// Add Expense Form
document.getElementById("expenseForm").addEventListener("submit", async function (event) {

    event.preventDefault();

    const description = document.getElementById("description").value;
    const amount = document.getElementById("amount").value;
    const date = document.getElementById("date").value;

    if (!description || !amount || !date) {
        alert("Please fill in all fields.");
        return;
    }

    try {

        const response = await fetch(`${API_URL}/predict`, {
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
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Prediction failed");
        }


        // Save current expense information
        currentDescription = description;
        currentPrediction = data.category;


        // Display prediction
        document.getElementById("predictionText").textContent =
            `AI Prediction: ${data.category} (${data.prediction_type})`;


        // Show feedback buttons
        document.getElementById("feedbackSection").classList.remove("hidden");


        // Add expense to history
        addExpenseToTable(
            description,
            amount,
            date,
            data.category
        );

    } catch (error) {

        console.error("Error:", error);

        document.getElementById("predictionText").textContent =
            "Unable to connect to AI backend.";

        alert("Could not connect to the AWS backend.");
    }

});


// Add expense to history table
function addExpenseToTable(description, amount, date, category) {

    const tableBody = document.getElementById("expenseTable");

    const row = document.createElement("tr");

    row.innerHTML = `
        <td>${description}</td>
        <td>₹${amount}</td>
        <td>${date}</td>
        <td>${category}</td>
    `;

    tableBody.appendChild(row);
}


// User accepts prediction
document.getElementById("acceptButton").addEventListener("click", function () {

    alert("AI prediction accepted!");

});


// User corrects prediction
document.getElementById("correctButton").addEventListener("click", async function () {

    const correctCategory = prompt(
        "Enter the correct category:\nFood, Education, Transport, Shopping"
    );

    if (!correctCategory) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: USER_ID,
                description: currentDescription,
                category: correctCategory
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Feedback failed");
        }


        // Update prediction display
        document.getElementById("predictionText").textContent =
            `Corrected Category: ${correctCategory}`;


        alert("Your correction has been learned by the AI!");

    } catch (error) {

        console.error("Error:", error);

        alert("Could not save your correction.");
    }

});