import sys
import os
import re

# Allow Python to access the project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from flask_cors import CORS
from ml.predict import predict_category


app = Flask(__name__)
CORS(app)


# Temporary local storage for personalized learning
# Later this will be replaced by DynamoDB.
user_preferences = {}


def get_personalized_category(user_id, description):
    """
    Find a personalized category using meaningful keywords
    from the user's previous corrections.
    """

    if user_id not in user_preferences:
        return None

    # Words that are too general to be useful for personalization
    ignored_words = {
        "amazon",
        "online",
        "purchase",
        "bought",
        "buy",
        "new",
        "item",
        "product",
        "shop",
        "store",
        "order",
        "payment",
        "using",
        "from",
        "with",
        "for",
        "the"
    }

    def get_meaningful_words(text):
        words = re.findall(r"[a-zA-Z]+", text.lower())

        return {
            word
            for word in words
            if len(word) >= 4 and word not in ignored_words
        }

    current_words = get_meaningful_words(description)

    if not current_words:
        return None

    best_category = None
    best_score = 0

    for learned_description, category in user_preferences[user_id].items():

        learned_words = get_meaningful_words(learned_description)

        if not learned_words:
            continue

        # Find meaningful words shared by the new expense
        # and the previously corrected expense.
        common_words = current_words.intersection(learned_words)

        if not common_words:
            continue

        # Calculate similarity based on the number
        # of meaningful words that match.
        score = len(common_words) / len(current_words.union(learned_words))

        if score > best_score:
            best_score = score
            best_category = category

    # Require a reasonably strong match
    if best_score >= 0.25:
        return best_category

    return None


@app.route("/")
def home():
    return jsonify({
        "message": "SmartSpend AI backend is running"
    })


@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json()

    description = data.get("description", "").strip()
    user_id = data.get("user_id", "demo_user")

    if not description:
        return jsonify({
            "error": "Description is required"
        }), 400

    # First check personalized learning
    personalized_category = get_personalized_category(
        user_id,
        description
    )

    if personalized_category:
        category = personalized_category
        prediction_type = "Personalized"
    else:
        # Otherwise use the general ML model
        category = predict_category(description)
        prediction_type = "General ML"

    return jsonify({
        "description": description,
        "category": category,
        "prediction_type": prediction_type
    })


@app.route("/feedback", methods=["POST"])
def feedback():

    data = request.get_json()

    user_id = data.get("user_id", "demo_user")
    description = data.get("description", "").strip()
    category = data.get("category", "").strip()

    if not description or not category:
        return jsonify({
            "error": "Description and category are required"
        }), 400

    # Create storage for this user
    if user_id not in user_preferences:
        user_preferences[user_id] = {}

    # Store the user's correction
    user_preferences[user_id][description] = category

    return jsonify({
        "message": "User preference learned successfully",
        "user_id": user_id,
        "description": description,
        "category": category
    })


if __name__ == "__main__":
    app.run(debug=True)