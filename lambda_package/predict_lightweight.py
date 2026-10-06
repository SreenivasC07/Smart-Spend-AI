import json
import math
import os
import re


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "model_parameters.json"
)


# Load exported TF-IDF + Logistic Regression parameters
with open(MODEL_PATH, "r", encoding="utf-8") as file:
    model = json.load(file)


vocabulary = model["vocabulary"]
idf = model["idf"]
classes = model["classes"]
coefficients = model["coefficients"]
intercept = model["intercept"]


def tokenize(text):
    """Create tokens similar to the original TF-IDF tokenizer."""

    text = text.lower()

    # Equivalent to the default sklearn token pattern:
    # tokens containing at least 2 alphanumeric characters
    return re.findall(r"(?u)\b\w\w+\b", text)


def create_tfidf_vector(text):
    """Create a TF-IDF vector using the exported model parameters."""

    tokens = tokenize(text)

    # Count words
    word_counts = {}

    for token in tokens:
        if token in vocabulary:
            word_counts[token] = word_counts.get(token, 0) + 1

    # Create TF-IDF values
    vector = [0.0] * len(vocabulary)

    for word, count in word_counts.items():

        index = vocabulary[word]

        # Raw term frequency × IDF
        vector[index] = count * idf[index]

    # sklearn TfidfVectorizer uses L2 normalization by default
    magnitude = math.sqrt(
        sum(value * value for value in vector)
    )

    if magnitude > 0:
        vector = [
            value / magnitude
            for value in vector
        ]

    return vector


def predict_category(description):
    """Predict expense category using Logistic Regression."""

    vector = create_tfidf_vector(description)

    scores = []

    # Calculate decision score for each class
    for class_index in range(len(classes)):

        score = intercept[class_index]

        for feature_index, value in enumerate(vector):

            if value != 0:
                score += (
                    coefficients[class_index][feature_index]
                    * value
                )

        scores.append(score)

    # Select class with highest score
    best_index = max(
        range(len(scores)),
        key=lambda index: scores[index]
    )

    return classes[best_index]


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

        print(
            f"{expense} -> {category}"
        )