# SmartSpend AI – AI-Powered Personalized Expense Tracker

## 1. Project Overview

SmartSpend AI is a web-based expense tracking application that helps users record, categorize, and manage their daily expenses. It uses Machine Learning to predict expense categories based on transaction descriptions and learns from user feedback to improve future predictions.

The project also uses AWS services and an automated CI/CD pipeline to simplify application deployment and updates.

## 2. Objectives

- Record and manage daily expenses.
- Automatically predict expense categories using Machine Learning.
- Personalize predictions based on user feedback.
- Allow users to view expense history and edit existing expenses.
- Secure user access through Amazon Cognito authentication.
- Automate deployment using AWS CodePipeline and AWS CodeBuild.

## 3. Technologies Used

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, AWS Lambda |
| API | Amazon API Gateway |
| Database | Amazon DynamoDB |
| Authentication | Amazon Cognito |
| Machine Learning | TF-IDF and Logistic Regression |
| Frontend Hosting | Amazon S3 and Amazon CloudFront |
| CI/CD | GitHub, AWS CodePipeline, AWS CodeBuild |
| Version Control | Git and GitHub |

## 4. Key Features

### AI-Based Expense Categorization
The application predicts expense categories from descriptions such as shopping purchases, food orders, transport expenses, and educational purchases.

### Personalized Learning
Users can provide feedback when a predicted category is incorrect. The application stores this feedback and uses it to personalize future predictions.

### Expense Management
Users can add expenses, view expense history, and edit existing expense records.

### Secure Authentication
Amazon Cognito provides user authentication. The backend uses the authenticated user's identity to associate expense records with that user.

### Automated Deployment
The CI/CD pipeline connects the GitHub repository to AWS CodeBuild and AWS CodePipeline to automate application build and deployment tasks.

## 5. System Architecture

1. The user accesses the web application through Amazon CloudFront.
2. The frontend sends requests to Amazon API Gateway.
3. API Gateway uses Amazon Cognito authentication to protect configured routes.
4. AWS Lambda processes expense and prediction requests.
5. Amazon DynamoDB stores expense records and user feedback.
6. The Machine Learning component predicts expense categories and supports personalized predictions.
7. GitHub, AWS CodeBuild, and AWS CodePipeline support the deployment workflow.

## 6. Machine Learning Approach

The project uses **TF-IDF and Logistic Regression** for text-based expense categorization.

- **TF-IDF:** Converts expense descriptions into numerical features.
- **Logistic Regression:** Predicts a category using the extracted text features.
- **User Feedback:** Helps the application personalize future predictions according to the user's corrections.

Example categories include Education, Food, Shopping, and Transport.

## 7. AWS Services

- **Amazon S3:** Stores the frontend website files.
- **Amazon CloudFront:** Delivers the frontend through a distribution.
- **Amazon API Gateway:** Provides API endpoints for the frontend.
- **AWS Lambda:** Executes backend application logic.
- **Amazon DynamoDB:** Stores expenses and feedback.
- **Amazon Cognito:** Handles user authentication.
- **AWS CodePipeline:** Orchestrates the deployment pipeline.
- **AWS CodeBuild:** Runs configured build and deployment commands.
- **AWS IAM:** Controls access permissions between AWS services.

## 8. CI/CD Workflow

The deployment workflow is designed as follows:

1. Source code is maintained in GitHub.
2. A code change is pushed to the repository.
3. AWS CodePipeline obtains the source code.
4. AWS CodeBuild executes the commands defined in the build specification.
5. The configured deployment steps update the frontend and backend.
6. The deployed application is tested to verify its functionality.

**Note:** Automatic pipeline triggering is still being investigated. A successful pipeline execution confirms that the executed pipeline run completed, but does not by itself confirm that every future GitHub push triggers a new run automatically.

## 9. Testing and Validation

The following application features have been tested:

| Test case | Result |
|---|---|
| Add a new expense | Passed |
| Provide category feedback | Passed |
| Personalized category prediction | Passed |
| Edit an existing expense | Passed |
| Save and verify edited expense data | Passed |
| AWS CodePipeline execution | Succeeded |

## 10. Project Structure

```text
expense-tracker/
├── backend/
│   ├── app.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── ml/
│   ├── train_model.py
│   ├── predict.py
│   ├── expense_model.pkl
│   └── model_parameters.json
├── lambda_package/
│   ├── lambda_function.py
│   ├── predict_lightweight.py
│   └── model_parameters.json
├── tests/
│   └── test_app.py
├── export_model.py
├── buildspec.yml
└── README.md
```

## 11. Conclusion

SmartSpend AI combines expense management, Machine Learning, personalized predictions, cloud hosting, authentication, and automated deployment in one application. The project demonstrates how AWS services can be integrated with a Python-based application to create a practical and extensible expense tracking system.

Future enhancements may include monthly spending reports, budget alerts, expense analytics, and improved personalization.
