import joblib


# Load the trained model
model = joblib.load("ml/expense_model.pkl")


def predict_category(description):
    """
    Predict the expense category using
    TF-IDF + Logistic Regression.
    """

    prediction = model.predict([description])

    return prediction[0]


# Test the model
if __name__ == "__main__":

    test_expenses = [
        "Python programming book",
        "pizza dinner",
        "Uber ride",
        "Amazon headphones",
        "college course"
    ]

    for expense in test_expenses:

        category = predict_category(expense)

        print(f"{expense} -> {category}")