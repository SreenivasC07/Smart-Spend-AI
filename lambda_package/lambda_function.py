import json
import os
import re
import uuid
from datetime import datetime
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from predict_lightweight import predict_category


# DynamoDB
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("ExpenseTracker")


# Words that are too general for personalization
IGNORED_WORDS = {
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
        if len(word) >= 4 and word not in IGNORED_WORDS
    }


def get_personalized_category(user_id, description):
    """
    Check the user's previous corrections and find
    a matching personalized category.
    """

    try:

        response = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id)
        )

        items = response.get("Items", [])

        current_words = get_meaningful_words(description)

        if not current_words:
            return None

        best_category = None
        best_score = 0

        for item in items:

            # Only use feedback records for personalization
            if item.get("item_type") != "feedback":
                continue

            learned_description = item.get("description", "")
            category = item.get("category", "")

            learned_words = get_meaningful_words(
                learned_description
            )

            if not learned_words:
                continue

            common_words = current_words.intersection(
                learned_words
            )

            if not common_words:
                continue

            score = len(common_words) / len(
                current_words.union(learned_words)
            )

            if score > best_score:
                best_score = score
                best_category = category

        if best_score >= 0.25:
            return best_category

        return None

    except Exception:
        # If personalization lookup fails,
        # fall back to the general ML model.
        return None


def get_request_data(event):

    if "body" in event:

        body = event["body"]

        if isinstance(body, str):
            return json.loads(body)

        return body

    return event


def predict_expense(data):

    user_id = data.get("user_id", "demo_user")
    description = data.get("description", "").strip()
    amount = data.get("amount")
    date = data.get("date")

    if not description:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "Description is required"
            })
        }

    # Check personalized learning first
    personalized_category = get_personalized_category(
        user_id,
        description
    )

    if personalized_category:

        category = personalized_category
        prediction_type = "Personalized"

    else:

        category = predict_category(description)
        prediction_type = "General ML"

    # Generate unique expense ID
    expense_id = str(uuid.uuid4())

    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    # Create DynamoDB item
    item = {
        "user_id": user_id,
        "expense_id": expense_id,
        "item_type": "expense",
        "description": description,
        "category": category,
        "date": date
    }

    # Store amount if provided
    if amount is not None and amount != "":
        item["amount"] = Decimal(str(amount))

    table.put_item(Item=item)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "message": "Expense saved successfully",
            "expense_id": expense_id,
            "description": description,
            "category": category,
            "prediction_type": prediction_type
        })
    }


def save_feedback(data):

    user_id = data.get("user_id", "demo_user")
    description = data.get("description", "").strip()
    category = data.get("category", "").strip()

    if not description or not category:

        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "Description and category are required"
            })
        }

    feedback_id = "feedback#" + str(uuid.uuid4())

    # Store the user's correction
    table.put_item(
        Item={
            "user_id": user_id,
            "expense_id": feedback_id,
            "item_type": "feedback",
            "description": description,
            "category": category
        }
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "message": "User preference learned successfully",
            "user_id": user_id,
            "description": description,
            "category": category
        })
    }


def lambda_handler(event, context):

    try:

        data = get_request_data(event)

        # Determine requested operation
        path = event.get("rawPath", event.get("path", ""))

        if path.endswith("/feedback"):
            return save_feedback(data)

        # Default operation is prediction
        return predict_expense(data)

    except Exception as e:

        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "error": str(e)
            })
        }