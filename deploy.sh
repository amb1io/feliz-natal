#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Copy .env.example to .env and fill in your values."
    exit 1
fi

STACK_NAME="feliz-natal-cognito-stack"

echo "Deploying Cognito stack..."

aws cloudformation deploy \
    --template-file cognito-template.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        UserPoolName=$USER_POOL_NAME \
        GoogleClientId=$GOOGLE_CLIENT_ID \
        GoogleClientSecret=$GOOGLE_CLIENT_SECRET \
        MicrosoftClientId=$MICROSOFT_CLIENT_ID \
        MicrosoftClientSecret=$MICROSOFT_CLIENT_SECRET \
        MicrosoftTenantId=$MICROSOFT_TENANT_ID \
        SlackClientId=$SLACK_CLIENT_ID \
        SlackClientSecret=$SLACK_CLIENT_SECRET \
        CallbackURLs=$CALLBACK_URLS \
        LogoutURLs=$LOGOUT_URLS \
    --capabilities CAPABILITY_IAM \
    --region $AWS_REGION

if [ $? -eq 0 ]; then
    echo "Stack deployed successfully!"
    echo ""
    echo "Fetching outputs..."
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs' \
        --output table
else
    echo "Stack deployment failed!"
    exit 1
fi
