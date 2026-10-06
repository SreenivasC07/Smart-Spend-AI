import json
import re
import uuid
from datetime import datetime
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from predict_lightweight import predict_category


# ==========================================
# DynamoDB
# ==========================================

dynamodb = boto3.resource("dynamodb")

table = dynamodb.Table("ExpenseTracker")


# ==========================================
# Words ignored during personalization
# ==========================================

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


# ==========================================
# Get meaningful words
# ==========================================

def get_meaningful_words(text):

    words = re.findall(
        r"[a-zA-Z]+",
        text.lower()
    )

    return {
        word
        for word in words
        if len(word) >= 4
        and word not in IGNORED_WORDS
    }


# ==========================================
# Personalized category prediction
# ==========================================

def get_personalized_category(
    user_id,
    description
):
    """
    Check the user's previous corrections
    and find a matching personalized category.
    """

    try:

        response = table.query(
            KeyConditionExpression=
            Key("user_id").eq(user_id)
        )

        items = response.get(
            "Items",
            []
        )

        current_words = get_meaningful_words(
            description
        )

        if not current_words:
            return None

        best_category = None
        best_score = 0

        for item in items:

            # Only use feedback records
            if item.get("item_type") != "feedback":
                continue

            learned_description = item.get(
                "description",
                ""
            )

            category = item.get(
                "category",
                ""
            )

            learned_words = get_meaningful_words(
                learned_description
            )

            if not learned_words:
                continue

            common_words = (
                current_words.intersection(
                    learned_words
                )
            )

            if not common_words:
                continue

            score = (
                len(common_words)
                /
                len(
                    current_words.union(
                        learned_words
                    )
                )
            )

            if score > best_score:

                best_score = score
                best_category = category

        if best_score >= 0.25:
            return best_category

        return None

    except Exception:

        # If personalization lookup fails,
        # use the general ML model.
        return None


# ==========================================
# Get request data
# ==========================================

def get_request_data(event):

    data = {}

    # Read data from request body
    if "body" in event and event["body"]:

        body = event["body"]

        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = body

    # Read query parameters
    query_parameters = event.get(
        "queryStringParameters"
    )

    if query_parameters:

        data.update(query_parameters)

    return data


# ==========================================
# Predict and save expense
# ==========================================

def predict_expense(data):

    user_id = data.get(
        "user_id",
        "demo_user"
    )

    description = data.get(
        "description",
        ""
    ).strip()

    amount = data.get("amount")

    date = data.get("date")


    # Validate description

    if not description:

        return {
            "statusCode": 400,

            "headers": {
                "Content-Type":
                "application/json"
            },

            "body": json.dumps({
                "error":
                "Description is required"
            })
        }


    # ======================================
    # Check personalized learning first
    # ======================================

    personalized_category = (
        get_personalized_category(
            user_id,
            description
        )
    )


    if personalized_category:

        category = personalized_category

        prediction_type = "Personalized"

    else:

        category = predict_category(
            description
        )

        prediction_type = "General ML"


    # ======================================
    # Generate expense ID
    # ======================================

    expense_id = str(
        uuid.uuid4()
    )


    # Use today's date if not provided

    if not date:

        date = datetime.now().strftime(
            "%Y-%m-%d"
        )


    # ======================================
    # Create DynamoDB item
    # ======================================

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

        item["amount"] = Decimal(
            str(amount)
        )


    # Save expense

    table.put_item(
        Item=item
    )


    # ======================================
    # Return prediction result
    # ======================================

    return {

        "statusCode": 200,

        "headers": {
            "Content-Type":
            "application/json"
        },

        "body": json.dumps({

            "message":
            "Expense saved successfully",

            "expense_id":
            expense_id,

            "description":
            description,

            "category":
            category,

            "prediction_type":
            prediction_type

        })

    }


# ==========================================
# Save user feedback
# ==========================================

def save_feedback(data):

    user_id = data.get(
        "user_id",
        "demo_user"
    )

    description = data.get(
        "description",
        ""
    ).strip()

    category = data.get(
        "category",
        ""
    ).strip()


    # Validate input

    if not description or not category:

        return {

            "statusCode": 400,

            "headers": {
                "Content-Type":
                "application/json"
            },

            "body": json.dumps({

                "error":
                "Description and category are required"

            })

        }


    # Generate feedback ID

    feedback_id = (
        "feedback#"
        +
        str(uuid.uuid4())
    )


    # Store user's correction

    table.put_item(

        Item={

            "user_id":
            user_id,

            "expense_id":
            feedback_id,

            "item_type":
            "feedback",

            "description":
            description,

            "category":
            category

        }

    )


    return {

        "statusCode": 200,

        "headers": {
            "Content-Type":
            "application/json"
        },

        "body": json.dumps({

            "message":
            "User preference learned successfully",

            "user_id":
            user_id,

            "description":
            description,

            "category":
            category

        })

    }


# ==========================================
# Get saved expenses
# ==========================================

def get_expenses(data):

    user_id = data.get(
        "user_id",
        "demo_user"
    )


    # Retrieve all records
    # belonging to this user

    response = table.query(

        KeyConditionExpression=
        Key("user_id").eq(user_id)

    )


    items = response.get(
        "Items",
        []
    )


    expenses = []


    for item in items:

        # Only return actual expenses.
        # Feedback records are excluded.

        if item.get(
            "item_type"
        ) != "expense":

            continue


        expense = {

            "expense_id":
            item.get(
                "expense_id"
            ),

            "description":
            item.get(
                "description",
                ""
            ),

            "category":
            item.get(
                "category",
                ""
            ),

            "date":
            item.get(
                "date",
                ""
            ),

            "amount":
            str(
                item.get(
                    "amount",
                    "0"
                )
            )

        }


        expenses.append(
            expense
        )


    # Newest expenses first

    expenses.sort(

        key=lambda x:
        x.get(
            "date",
            ""
        ),

        reverse=True

    )


    return {

        "statusCode": 200,

        "headers": {

            "Content-Type":
            "application/json",

            "Access-Control-Allow-Origin":
            "*"

        },

        "body": json.dumps({

            "expenses":
            expenses

        })

    }


# ==========================================
# Lambda Handler
# ==========================================

def lambda_handler(
    event,
    context
):

    try:

        # Get request data

        data = get_request_data(
            event
        )


        # Determine API path

        path = event.get(
            "rawPath",
            event.get(
                "path",
                ""
            )
        )


        # ==================================
        # POST /feedback
        # ==================================

        if path.endswith(
            "/feedback"
        ):

            return save_feedback(
                data
            )


        # ==================================
        # GET /expenses
        # ==================================

        if path.endswith(
            "/expenses"
        ):

            return get_expenses(
                data
            )


        # ==================================
        # POST /predict
        # ==================================

        return predict_expense(
            data
        )


    except Exception as e:

        return {

            "statusCode": 500,

            "headers": {

                "Content-Type":
                "application/json",

                "Access-Control-Allow-Origin":
                "*"

            },

            "body": json.dumps({

                "error":
                str(e)

            })

        }