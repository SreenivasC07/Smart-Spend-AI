import json
import joblib


MODEL_PATH = "ml/expense_model.pkl"
OUTPUT_PATH = "ml/model_parameters.json"


# Load the trained sklearn pipeline
model = joblib.load(MODEL_PATH)

# Get the TF-IDF vectorizer
vectorizer = model.named_steps["tfidf"]

# Get the Logistic Regression classifier
classifier = model.named_steps["classifier"]


# Extract TF-IDF information
vocabulary = vectorizer.vocabulary_
idf = vectorizer.idf_


# Extract Logistic Regression information
classes = classifier.classes_.tolist()
coefficients = classifier.coef_.tolist()
intercept = classifier.intercept_.tolist()


parameters = {
    "vocabulary": vocabulary,
    "idf": idf.tolist(),
    "classes": classes,
    "coefficients": coefficients,
    "intercept": intercept,
    "norm": vectorizer.norm,
    "lowercase": vectorizer.lowercase,
    "token_pattern": vectorizer.token_pattern,
}


with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
    json.dump(parameters, file)


print("Model parameters exported successfully.")
print("Vocabulary size:", len(vocabulary))
print("Classes:", classes)
print("Output:", OUTPUT_PATH)