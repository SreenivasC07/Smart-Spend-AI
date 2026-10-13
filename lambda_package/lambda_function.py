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
    "the",
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
# Get authenticated user ID from Cognito JWT
# ==========================================

def get_user_id_from_event(event):
    """
    Get the authenticated Cognito user's unique
    user ID from the JWT token supplied by
    API Gateway.

    API Gateway HTTP API JWT claims:
    event
      -> requestContext
      -> authorizer
      -> jwt
      -> claims
      -> sub
    """

    try:
        claims = (
            event
            .get("requestContext", {})
            .get("authorizer", {})
            .get("jwt", {})
            .get("claims", {})
        )

        user_id = claims.get("sub")

        if not user_id:
            raise ValueError(
                "Authenticated user ID not found"
            )

        return user_id

    except Exception:
        raise ValueError(
            "Invalid or missing authentication token"
        )


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

def predict_expense(
    data,
    user_id
):

    description = data.get(
        "description",
        ""
    ).strip()

    amount = data.get("amount")

    date = data.get("date")


    # ======================================
    # Validate description
    # ======================================

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


    # ======================================
    # Use today's date if not provided
    # ======================================

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


    # ======================================
    # Store amount if provided
    # ======================================

    if amount is not None and amount != "":

        item["amount"] = Decimal(
            str(amount)
        )


    # ======================================
    # Save expense
    # ======================================

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
            "application/json",

            "Access-Control-Allow-Origin":
            "*"
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

def save_feedback(
    data,
    user_id
):

    description = data.get(
        "description",
        ""
    ).strip()

    category = data.get(
        "category",
        ""
    ).strip()


    # ======================================
    # Validate input
    # ======================================

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


    # ======================================
    # Generate feedback ID
    # ======================================

    feedback_id = (
        "feedback#"
        +
        str(uuid.uuid4())
    )


    # ======================================
    # Store user's correction
    # ======================================

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
            "application/json",

            "Access-Control-Allow-Origin":
            "*"
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
# Edit an existing expense
# ==========================================



# ==========================================
# Get saved expenses
# ==========================================

def get_expenses(
    user_id
):

    # ======================================
    # Retrieve all records belonging
    # to this authenticated user
    # ======================================

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


    # ======================================
    # Newest expenses first
    # ======================================

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
# Update an existing expense
# ==========================================

def update_expense(data, user_id, expense_id):
    """Update an expense only if it belongs to the authenticated user."""
    description = str(data.get("description", "")).strip()
    category = str(data.get("category", "")).strip()
    date_value = str(data.get("date", "")).strip()
    amount_value = data.get("amount")
    allowed_categories = {"Food", "Education", "Transport", "Shopping", "Other"}

    if not expense_id:
        return api_response(400, {"error": "Expense ID is required."})
    if not description or not category or not date_value or amount_value is None:
        return api_response(400, {"error": "Description, amount, date, and category are required."})
    if category not in allowed_categories:
        return api_response(400, {"error": "Invalid category."})
    try:
        amount = Decimal(str(amount_value))
        if amount <= 0:
            raise ValueError()
    except Exception:
        return api_response(400, {"error": "Amount must be a number greater than zero."})

    existing = table.get_item(Key={"user_id": user_id, "expense_id": expense_id}).get("Item")
    if not existing or existing.get("item_type") != "expense":
        return api_response(404, {"error": "Expense not found."})

    table.update_item(
        Key={"user_id": user_id, "expense_id": expense_id},
        UpdateExpression="SET description = :description, amount = :amount, #category = :category, #date = :date",
        ExpressionAttributeNames={"#category": "category", "#date": "date"},
        ConditionExpression="item_type = :expense_type",
        ExpressionAttributeValues={
            ":description": description,
            ":amount": amount,
            ":category": category,
            ":date": date_value,
            ":expense_type": "expense",
        },
    )
    return api_response(200, {"message": "Expense updated successfully.", "expense_id": expense_id})


def api_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, default=str),
    }


# ==========================================
# Lambda Handler
# ==========================================

def lambda_handler(
    event,
    context
):

    try:

        # ==================================
        # Get authenticated Cognito user
        # ==================================

        user_id = get_user_id_from_event(
            event
        )


        # ==================================
        # Get request data
        # ==================================

        data = get_request_data(
            event
        )


        # ==================================
        # Determine API path
        # ==================================

        path = event.get(
            "rawPath",
            event.get(
                "path",
                ""
            )
        )



        http_method = (event.get("requestContext", {}).get("http", {}).get("method")
                       or event.get("httpMethod", "GET")).upper()
        path_parameters = event.get("pathParameters") or {}
        expense_id = path_parameters.get("expense_id")
        if not expense_id and "/expenses/" in path:
            expense_id = path.split("/expenses/", 1)[1].split("/", 1)[0]

        # PUT /expenses/{expense_id}
        if http_method == "PUT" and expense_id:
            return update_expense(data, user_id, expense_id)


        # ==================================
        # POST /feedback
        # ==================================

        if path.endswith(
            "/feedback"
        ):

            return save_feedback(
                data,
                user_id
            )


        # ==================================
        # GET /expenses
        # ==================================

        if path.endswith(
            "/expenses"
        ):

            return get_expenses(
                user_id
            )


        # ==================================
        # POST /predict
        # ==================================

        return predict_expense(
            data,
            user_id
        )


    except ValueError as e:

        return {

            "statusCode": 401,

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
