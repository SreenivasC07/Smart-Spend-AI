from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import joblib


# Training data
descriptions = [
    "grocery shopping",
    "vegetables and fruits",
    "pizza dinner",
    "restaurant lunch",
    "food delivery",
    "coffee",
    "python programming book",
    "online programming course",
    "college fees",
    "education course",
    "study materials",
    "exam registration",
    "uber ride",
    "bus ticket",
    "train ticket",
    "taxi ride",
    "petrol for car",
    "fuel",
    "amazon headphones",
    "new clothes",
    "shoes purchase",
    "shopping mall",
    "mobile accessories",
    "watch purchase"
]

categories = [
    "Food",
    "Food",
    "Food",
    "Food",
    "Food",
    "Food",
    "Education",
    "Education",
    "Education",
    "Education",
    "Education",
    "Education",
    "Transport",
    "Transport",
    "Transport",
    "Transport",
    "Transport",
    "Transport",
    "Shopping",
    "Shopping",
    "Shopping",
    "Shopping",
    "Shopping",
    "Shopping"
]


# Create ML pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", LogisticRegression())
])


# Train the model
model.fit(descriptions, categories)


# Save the trained model
joblib.dump(model, "expense_model.pkl")

print("Model trained successfully!")
print("Saved as expense_model.pkl")